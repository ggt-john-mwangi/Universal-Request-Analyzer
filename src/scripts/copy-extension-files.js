const fs = require("fs-extra")
const path = require("path")

// Paths
const buildDir = path.resolve(__dirname, "../build")
const publicDir = path.resolve(__dirname, "../public")

console.log("Copying extension files to build directory...")

// Copy background scripts
console.log("Copying background scripts...")
fs.copySync(path.join(publicDir, "background"), path.join(buildDir, "background"))

// Copy content scripts
console.log("Copying content scripts...")
fs.copySync(path.join(publicDir, "content"), path.join(buildDir, "content"))

// Copy wasm files if they exist
if (fs.existsSync(path.join(publicDir, "wasm"))) {
  console.log("Copying wasm files...")
  fs.copySync(path.join(publicDir, "wasm"), path.join(buildDir, "wasm"))
}

console.log("Extension files copied successfully!")

