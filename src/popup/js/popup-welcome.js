// Welcome Screen and Tips Functions
// Handle first-time user experience and contextual tips

import { storage } from '../../background/compat/browser-compat.js';

// Tips to rotate through
const TIPS = [
  'Tip: Click any status code chip to filter requests',
  'Tip: Export data as HAR for sharing with your team',
  'Tip: Use Copy as cURL to reproduce requests in terminal',
  'Tip: Switch to Advanced mode for detailed charts and analytics',
  'Tip: Click the eye icon on any request to view full details',
  'Tip: Your data persists across browser sessions, unlike DevTools',
  'Tip: Use the Dashboard for cross-domain analytics',
  'Tip: Clear old data in Settings to free up storage space'
];

let currentTipIndex = 0;
let tipRotationInterval = null;

/**
 * Check if this is first time user and show welcome screen
 */
export async function checkAndShowWelcome() {
  try {
    const result = await storage.get(['hasSeenWelcome']);
    
    if (!result.hasSeenWelcome) {
      showWelcomeScreen();
    }
  } catch (error) {
    console.error('Error checking welcome status:', error);
  }
}

/**
 * Show the welcome screen overlay
 */
function showWelcomeScreen() {
  const overlay = document.getElementById('welcomeOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    
    // Setup event listeners
    const getStartedBtn = document.getElementById('getStartedBtn');
    if (getStartedBtn) {
      getStartedBtn.onclick = closeWelcomeScreen;
    }
  }
}

/**
 * Close welcome screen and save preference
 */
async function closeWelcomeScreen() {
  const overlay = document.getElementById('welcomeOverlay');
  const dontShowAgain = document.getElementById('dontShowAgain');
  
  if (overlay) {
    overlay.style.display = 'none';
  }
  
  // Save preference
  try {
    await storage.set({ hasSeenWelcome: true });
    
    // If user checked "don't show again", save that too
    if (dontShowAgain && dontShowAgain.checked) {
      await storage.set({ neverShowWelcome: true });
    }
  } catch (error) {
    console.error('Error saving welcome preference:', error);
  }
}

/**
 * Show tips banner with rotating tips
 */
export function showTipsBanner() {
  const banner = document.getElementById('tipBanner');
  if (!banner) return;
  
  // Check if user has dismissed tips
  storage.get(['tipsDismissed']).then(result => {
    if (!result.tipsDismissed) {
      banner.style.display = 'flex';
      startTipRotation();
      
      // Setup close button
      const closeBtn = document.getElementById('closeTipBtn');
      if (closeBtn) {
        closeBtn.onclick = dismissTipsBanner;
      }
    }
  });
}

/**
 * Start rotating tips
 */
function startTipRotation() {
  // Show first tip
  updateTipText();
  
  // Rotate every 15 seconds
  if (tipRotationInterval) {
    clearInterval(tipRotationInterval);
  }
  
  tipRotationInterval = setInterval(() => {
    currentTipIndex = (currentTipIndex + 1) % TIPS.length;
    updateTipText();
  }, 15000);
}

/**
 * Update the tip text
 */
function updateTipText() {
  const tipText = document.getElementById('tipText');
  if (tipText) {
    tipText.textContent = TIPS[currentTipIndex];
  }
}

/**
 * Dismiss tips banner permanently
 */
async function dismissTipsBanner() {
  const banner = document.getElementById('tipBanner');
  if (banner) {
    banner.style.display = 'none';
  }
  
  // Stop rotation
  if (tipRotationInterval) {
    clearInterval(tipRotationInterval);
    tipRotationInterval = null;
  }
  
  // Save dismissal preference
  try {
    await storage.set({ tipsDismissed: true });
  } catch (error) {
    console.error('Error saving tips preference:', error);
  }
}

/**
 * Show a contextual tip based on user action
 * @param {string} context - Context for the tip
 */
export function showContextualTip(context) {
  const tipMap = {
    'first_filter': 'Great! You can combine filters for more precise results.',
    'first_export': 'HAR files can be imported into many tools like Charles Proxy.',
    'advanced_mode': 'Advanced mode unlocks detailed analytics and charts.',
    'empty_state': 'Visit any website to start capturing network requests.'
  };
  
  const tip = tipMap[context];
  if (tip) {
    const tipText = document.getElementById('tipText');
    const banner = document.getElementById('tipBanner');
    
    if (tipText && banner) {
      tipText.textContent = tip;
      banner.style.display = 'flex';
      
      // Auto-hide after 10 seconds
      setTimeout(() => {
        banner.style.display = 'none';
      }, 10000);
    }
  }
}

/**
 * Cleanup tip rotation on popup close
 */
export function cleanupTips() {
  if (tipRotationInterval) {
    clearInterval(tipRotationInterval);
    tipRotationInterval = null;
  }
}
