const { zip } = require("zip-a-folder")
const path = require("path")
const fs = require("fs-extra")
const manifest = require("../../public/manifest.json")

async function packageExtension() {
  const buildDir = path.resolve(__dirname, "../build")
  const distDir = path.resolve(__dirname, "../dist")
  const zipPath = path.resolve(distDir, `universal-request-analyzer-v${manifest.version}.zip`)

  // Ensure dist directory exists
  fs.ensureDirSync(distDir)

  console.log("Packaging extension...")

  try {
    await zip(buildDir, zipPath)
    console.log(`Extension packaged successfully: ${zipPath}`)
  } catch (error) {
    console.error("Error packaging extension:", error)
    process.exit(1)
  }
}

packageExtension()

