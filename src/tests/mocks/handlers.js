// MSW request handlers
import { rest } from "msw"

// Mock API endpoints
export const handlers = [
  // Example handler for a hypothetical API endpoint
  rest.get("https://api.example.com/config", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        features: {
          onlineSync: true,
          authentication: true,
          remoteStorage: true,
        },
        permissions: {
          role: "admin",
          customPermissions: [],
        },
      }),
    )
  }),

  // Mock authentication endpoint
  rest.post("https://api.example.com/auth/login", (req, res, ctx) => {
    const { username, password } = req.body

    if (username === "testuser" && password === "password") {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          token: "mock-jwt-token",
          user: {
            id: "123",
            username: "testuser",
            role: "admin",
          },
        }),
      )
    }

    return res(
      ctx.status(401),
      ctx.json({
        success: false,
        message: "Invalid credentials",
      }),
    )
  }),

  // Mock data sync endpoint
  rest.post("https://api.example.com/sync", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        lastSyncTime: new Date().toISOString(),
      }),
    )
  }),

  // Mock feature flags endpoint
  rest.get("https://api.example.com/features", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        features: {
          captureRequests: true,
          filterRequests: true,
          exportData: true,
          statistics: true,
          visualization: true,
          onlineSync: true,
          authentication: true,
          remoteStorage: true,
          cloudExport: true,
          teamSharing: true,
          requestModification: false,
          requestMocking: false,
          automatedTesting: false,
          performanceAlerts: false,
          customRules: false,
          aiAnalysis: false,
          predictiveAnalytics: false,
          securityScanning: false,
        },
      }),
    )
  }),
]

