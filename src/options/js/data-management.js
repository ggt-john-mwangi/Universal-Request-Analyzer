/**
 * Data Management Module
 * Handles all data retention, cleanup, backup, and reset operations
 */

/**
 * Update Database Status Display
 * Shows current size, record count, and oldest record date
 */
export async function updateDatabaseSizeDisplay() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getDatabaseSize",
    });

    if (response && response.success) {
      const sizeElement = document.getElementById("currentDbSize");
      const recordsElement = document.getElementById("currentDbRecords");
      const oldestElement = document.getElementById("oldestRecord");

      if (sizeElement) {
        const sizeMB = (response.size / (1024 * 1024)).toFixed(2);
        sizeElement.textContent = `${sizeMB} MB`;

        // Color code based on size
        if (sizeMB > 100) {
          sizeElement.style.color = "#e53e3e";
        } else if (sizeMB > 50) {
          sizeElement.style.color = "#ed8936";
        } else {
          sizeElement.style.color = "#48bb78";
        }
      }

      if (recordsElement) {
        recordsElement.textContent = (response.records || 0).toLocaleString();
      }

      if (oldestElement && response.oldestDate) {
        const date = new Date(response.oldestDate);
        oldestElement.textContent = date.toLocaleDateString();
      } else if (oldestElement) {
        oldestElement.textContent = "N/A";
      }
    }
  } catch (error) {
    console.error("Failed to get database size:", error);
  }
}

/**
 * Preview Cleanup
 * Calculate and display statistics about records to be deleted
 */
export async function previewCleanup(showNotification) {
  const cleanupAge = document.getElementById("cleanupAge");
  const previewBox = document.getElementById("cleanupPreview");
  const recordsCount = document.getElementById("previewRecordsCount");
  const sizeFreed = document.getElementById("previewSizeFreed");
  const recordsRemaining = document.getElementById("previewRecordsRemaining");

  if (!cleanupAge || !previewBox) return;

  const days = parseInt(cleanupAge.value);
  if (isNaN(days) || days < 1) {
    showNotification("Please enter a valid number of days", true);
    return;
  }

  try {
    showNotification("Calculating cleanup preview...");

    const response = await chrome.runtime.sendMessage({
      action: "previewCleanup",
      days: days,
    });

    if (response && response.success) {
      if (recordsCount)
        recordsCount.textContent = response.recordsToDelete.toLocaleString();
      if (sizeFreed)
        sizeFreed.textContent =
          (response.sizeFreed / (1024 * 1024)).toFixed(2) + " MB";
      if (recordsRemaining)
        recordsRemaining.textContent =
          response.recordsRemaining.toLocaleString();

      previewBox.style.display = "block";

      // Enable Execute Cleanup button if there are records to delete
      const executeBtn = document.getElementById("executeCleanupBtn");
      if (executeBtn && response.recordsToDelete > 0) {
        executeBtn.disabled = false;
      }

      if (response.recordsToDelete > 0) {
        showNotification(
          `Preview complete: ${response.recordsToDelete.toLocaleString()} records can be deleted`
        );
      } else {
        showNotification("No records found matching cleanup criteria");
        // Disable Execute button if no records to delete
        if (executeBtn) {
          executeBtn.disabled = true;
        }
      }
    } else {
      console.error("Preview failed:", response);
      showNotification(
        "Failed to preview cleanup: " + (response?.error || "Unknown error"),
        true
      );
    }
  } catch (error) {
    console.error("Cleanup preview error:", error);
    showNotification("Failed to preview cleanup", true);
  }
}

/**
 * Create Backup Before Cleanup
 * Downloads complete SQLite database file
 */
export async function createBackupBeforeCleanup(showNotification) {
  const btn = document.getElementById("createBackupBtn");
  const lastBackup = document.getElementById("lastBackupTime");

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Backup...';
  }

  try {
    showNotification("Creating backup...");

    const response = await chrome.runtime.sendMessage({
      action: "createBackup",
      includeMetadata: true,
    });

    if (response && response.success) {
      if (lastBackup) {
        lastBackup.textContent = `Last backup: ${new Date().toLocaleString()}`;
      }

      showNotification(`Backup created successfully: ${response.filename}`);

      // Note: Cleanup button is only enabled by preview, not by backup
    } else {
      console.error("Backup failed:", response);
      showNotification(
        "Failed to create backup: " + (response?.error || "Unknown error"),
        true
      );
    }
  } catch (error) {
    console.error("Backup error:", error);
    showNotification("Failed to create backup", true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fas fa-save"></i> Create Backup Before Cleanup';
    }
  }
}

/**
 * Perform Cleanup With Confirmation
 * Deletes records older than specified age threshold
 */
export async function performCleanupWithConfirmation(showNotification) {
  const cleanupAge = document.getElementById("cleanupAge");
  const previewBox = document.getElementById("cleanupPreview");
  const recordsCount = document.getElementById("previewRecordsCount");

  if (!cleanupAge || !previewBox) return;

  // Check if preview was done
  if (previewBox.style.display === "none") {
    showNotification("Please preview cleanup first", true);
    return;
  }

  const days = parseInt(cleanupAge.value);
  const recordsToDelete = parseInt(
    recordsCount?.textContent?.replace(/,/g, "") || "0"
  );

  // Confirmation dialog
  const confirmed = confirm(
    `⚠️ WARNING: This will permanently delete ${recordsToDelete.toLocaleString()} records older than ${days} days.\n\n` +
      `Make sure you have created a backup first!\n\n` +
      `This action cannot be undone. Continue?`
  );

  if (!confirmed) return;

  // Second confirmation for large deletions
  if (recordsToDelete > 10000) {
    const doubleConfirm = confirm(
      `⚠️ FINAL CONFIRMATION\n\n` +
        `You are about to delete ${recordsToDelete.toLocaleString()} records.\n\n` +
        `Are you absolutely sure?`
    );

    if (!doubleConfirm) return;
  }

  const executeBtn = document.getElementById("executeCleanupBtn");
  if (executeBtn) {
    executeBtn.disabled = true;
    executeBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Cleaning Up...';
  }

  try {
    showNotification("Performing cleanup...");

    const response = await chrome.runtime.sendMessage({
      action: "performCleanup",
      days: days,
    });

    if (response && response.success) {
      showNotification(
        `Cleanup complete: ${response.recordsDeleted.toLocaleString()} records deleted`
      );

      // Hide preview and refresh database info
      previewBox.style.display = "none";
      await updateDatabaseSizeDisplay();

      // Keep button disabled - requires new preview
      if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.innerHTML = '<i class="fas fa-broom"></i> Execute Cleanup';
      }
    } else {
      console.error("Cleanup failed:", response);
      showNotification(
        "Failed to perform cleanup: " + (response?.error || "Unknown error"),
        true
      );
      // Re-enable button on failure
      if (executeBtn) {
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<i class="fas fa-broom"></i> Execute Cleanup';
      }
    }
  } catch (error) {
    console.error("Cleanup error:", error);
    showNotification("Failed to perform cleanup", true);
    // Re-enable button on error
    if (executeBtn) {
      executeBtn.disabled = false;
      executeBtn.innerHTML = '<i class="fas fa-broom"></i> Execute Cleanup';
    }
  }
}

/**
 * Reset Database
 * Completely wipes all data and recreates schema
 */
export async function resetDatabase(showNotification) {
  if (
    !confirm(
      "⚠️ WARNING: This will delete ALL data and cannot be undone!\n\nAre you sure you want to reset the database?"
    )
  ) {
    return;
  }

  if (!confirm("This is your last chance. Really reset the database?")) {
    return;
  }

  try {
    showNotification("Resetting database...");

    const response = await chrome.runtime.sendMessage({
      action: "resetDatabase",
    });

    if (response && response.success) {
      showNotification("Database reset successfully");
      await updateDatabaseSizeDisplay();
    } else {
      console.error("Reset failed:", response);
      showNotification(
        "Reset failed: " + (response?.error || "Unknown error"),
        true
      );
    }
  } catch (error) {
    console.error("Reset database error:", error);
    showNotification("Failed to reset database", true);
  }
}

/**
 * Vacuum Database
 * Compacts database to reclaim disk space
 */
export async function vacuumDatabase(showNotification) {
  if (
    !confirm(
      "Vacuum Database\n\n" +
        "This will compact the database to reclaim disk space.\n" +
        "The operation may take a few moments.\n\n" +
        "Proceed with vacuum?"
    )
  ) {
    return;
  }

  try {
    showNotification("Vacuuming database...");

    const response = await chrome.runtime.sendMessage({
      action: "vacuumDatabase",
    });

    if (response && response.success) {
      showNotification(response.message || "Database vacuumed successfully");
      await updateDatabaseSizeDisplay();
    } else {
      console.error("Vacuum failed:", response);
      showNotification(
        "Vacuum failed: " + (response?.error || "Unknown error"),
        true
      );
    }
  } catch (error) {
    console.error("Vacuum database error:", error);
    showNotification("Failed to vacuum database", true);
  }
}

/**
 * Clear Extension Cache
 * Clears chrome.storage.local and reloads extension
 */
export async function clearExtensionCache(showNotification) {
  if (!confirm("Clear extension cache and reload?")) {
    return;
  }

  try {
    await chrome.storage.local.clear();
    showNotification("Cache cleared. Reloading...");
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    console.error("Clear cache error:", error);
    showNotification("Failed to clear cache", true);
  }
}

/**
 * Initialize Data Management Event Listeners
 * Sets up all button click handlers for data management features
 */
export function initializeDataManagement(showNotification) {
  // Preview Cleanup button
  const previewCleanupBtn = document.getElementById("previewCleanupBtn");
  if (previewCleanupBtn) {
    previewCleanupBtn.addEventListener("click", () =>
      previewCleanup(showNotification)
    );
  }

  // Create Backup button
  const createBackupBtn = document.getElementById("createBackupBtn");
  if (createBackupBtn) {
    createBackupBtn.addEventListener("click", () =>
      createBackupBeforeCleanup(showNotification)
    );
  }

  // Execute Cleanup button
  const executeCleanupBtn = document.getElementById("executeCleanupBtn");
  if (executeCleanupBtn) {
    executeCleanupBtn.addEventListener("click", () =>
      performCleanupWithConfirmation(showNotification)
    );
  }

  // Reset Database button
  const resetDatabaseBtn = document.getElementById("resetDatabaseBtn");
  if (resetDatabaseBtn) {
    resetDatabaseBtn.addEventListener("click", () =>
      resetDatabase(showNotification)
    );
  }

  // Clear Cache button
  const clearCacheBtn = document.getElementById("clearCacheBtn");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", () =>
      clearExtensionCache(showNotification)
    );
  }

  // Vacuum Database button
  const vacuumDatabaseBtn = document.getElementById("vacuumDatabaseBtn");
  if (vacuumDatabaseBtn) {
    vacuumDatabaseBtn.addEventListener("click", () =>
      vacuumDatabase(showNotification)
    );
  }

  // Initialize database size display
  updateDatabaseSizeDisplay();
}
