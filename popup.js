document.addEventListener("DOMContentLoaded", () => {
  const requestsBody = document.getElementById("requestsBody");

  chrome.runtime.sendMessage({ action: "getNetworkRequests" }, (response) => {
    const { requests, performanceMetrics, resourceDetails, networkErrors } =
      response;

    requests.forEach((request) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${new URL(request.url).hostname}</td>
        <td>${request.method}</td>
        <td>${request.status || "Pending"}</td>
        <td>${request.duration || "N/A"}</td>
      `;
      requestsBody.appendChild(row);
    });

    // Optional: Log additional details to console for debugging
    console.log("Performance Metrics:", performanceMetrics);
    console.log("Resource Details:", resourceDetails);
    console.log("Network Errors:", networkErrors);
  });
});
