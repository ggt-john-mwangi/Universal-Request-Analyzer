// MSW v2 request handlers
import { http, HttpResponse } from "msw"

// Mock API endpoints
export const handlers = [
  // Stub for Phase 2 cloud config API
  http.get("https://api.example.com/config", () => {
    return HttpResponse.json({
      features: {
        onlineSync: true,
        authentication: true,
        remoteStorage: true,
      },
      permissions: {
        role: "admin",
        customPermissions: [],
      },
    })
  }),
]
