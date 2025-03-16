/**
 * Script to prepare the Chrome extension after Angular build
 * This copies the manifest.json and handles any post-processing needs
 */
const fs = require("fs");
const path = require("path");

const sourceDir = path.resolve(__dirname, "..");
const distDir = path.resolve(sourceDir, "dist/ai-studio-extended");

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log("Created dist directory.");
}

// Read the manifest.json to get icon paths
let manifest;
try {
    const manifestPath = path.join(sourceDir, "manifest.json");
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    console.log("Successfully read manifest.json");
} catch (error) {
    console.error("Error reading manifest.json:", error.message);
    process.exit(1);
}

// Copy manifest.json
console.log("Copying manifest.json...");
try {
    fs.copyFileSync(path.join(sourceDir, "manifest.json"), path.join(distDir, "manifest.json"));
    console.log("Manifest copied successfully.");
} catch (error) {
    console.error("Error copying manifest:", error.message);
}

// Create assets directory if it doesn't exist
const assetsDir = path.join(distDir, "assets");
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log("Created assets directory.");
}

// Create icons directory
const iconsDir = path.join(assetsDir, "icons");
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
    console.log("Created icons directory.");
}

// Check for source icons
const srcIconsDir = path.join(sourceDir, "src/assets/icons");
if (!fs.existsSync(srcIconsDir)) {
    fs.mkdirSync(srcIconsDir, { recursive: true });
    console.log("Created source icons directory. Remember to add your icon files here.");
}

// Extract icon paths from manifest
if (manifest && manifest.action && manifest.action.default_icon) {
    const iconPaths = manifest.action.default_icon;
    console.log("Found icon paths in manifest:", iconPaths);

    // Process each icon defined in the manifest
    Object.entries(iconPaths).forEach(([size, iconPath]) => {
        // Extract the file name from the path
        const iconFileName = path.basename(iconPath);
        const srcIconPath = path.join(srcIconsDir, iconFileName);
        const destIconPath = path.join(distDir, iconPath);

        // Ensure destination directory exists
        const destIconDir = path.dirname(destIconPath);
        if (!fs.existsSync(destIconDir)) {
            fs.mkdirSync(destIconDir, { recursive: true });
        }

        if (fs.existsSync(srcIconPath)) {
            // Copy the icon if it exists
            fs.copyFileSync(srcIconPath, destIconPath);
            console.log(`Copied ${iconFileName} (size ${size}) to ${iconPath}`);
        } else {
            console.log(
                `Warning: Icon ${iconFileName} for size ${size} does not exist in src/assets/icons. You should create it.`
            );
        }
    });
} else {
    console.warn("No icons defined in manifest.json action.default_icon.");
}

// Copy or bundle content script
console.log("Processing content script...");
// This assumes you've configured Angular to output the content-script.js file
// or you can use a tool like webpack to bundle it separately

console.log("Extension preparation complete!");
console.log(`Your extension is ready in: ${distDir}`);
console.log("You can load it as an unpacked extension in Chrome developer mode.");
