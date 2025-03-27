import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import webExtension from "vite-plugin-web-extension"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: "./src/manifest.json",
      assets: "assets",
      browser: process.env.BROWSER || "chrome",
      webExtConfig: {
        startUrl: ["https://example.com"],
        // Firefox-specific settings
        firefox: {
          args: ["--verbose"],
          profile: "dev-edition-default",
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: "src/popup/index.html",
        options: "src/options/index.html",
        background: "src/background/index.js",
        content: "src/content/index.js",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/js/[name].[hash].js",
        assetFileNames: "assets/[ext]/[name].[hash].[ext]",
      },
    },
  },
})

