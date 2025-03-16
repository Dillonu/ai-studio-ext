/**
 * Script to generate placeholder icons for development
 * Creates simple colored squares for each icon size
 */
const fs = require("fs");
const path = require("path");

const sourceDir = path.resolve(__dirname, "..");
const srcIconsDir = path.join(sourceDir, "src/assets/icons");

// Read the manifest to get the icon paths
let manifest;
try {
    const manifestPath = path.join(sourceDir, "manifest.json");
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    console.log("Successfully read manifest.json");
} catch (error) {
    console.error("Error reading manifest.json:", error.message);
    process.exit(1);
}

// Ensure the icons directory exists
if (!fs.existsSync(srcIconsDir)) {
    fs.mkdirSync(srcIconsDir, { recursive: true });
    console.log("Created source icons directory.");
}

/**
 * Creates a simple square icon of a specific size and color
 * @param {string} filePath - The path to save the icon
 * @param {number} size - The size of the icon in pixels
 * @param {string} color - The background color in hex format
 */
function createPlaceholderIcon(filePath, size, color) {
    // Create a simple SVG square with the specified color
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="${color}" />
        <text x="50%" y="50%" font-family="Arial" font-size="${
            size / 4
        }" fill="white" text-anchor="middle" dominant-baseline="middle">${size}</text>
    </svg>`;

    fs.writeFileSync(filePath, svg);
    console.log(`Created placeholder icon: ${filePath}`);
}

// Extract icon paths from manifest and create placeholders
if (manifest && manifest.action && manifest.action.default_icon) {
    const iconPaths = manifest.action.default_icon;
    console.log("Found icon paths in manifest:", iconPaths);

    // Base color for icons (AI Studio theme)
    const baseColor = "#4285F4"; // Google blue

    // Process each icon defined in the manifest
    Object.entries(iconPaths).forEach(([size, iconPath]) => {
        // Extract the file name from the path and create full source path
        const iconFileName = path.basename(iconPath);
        const srcIconPath = path.join(srcIconsDir, iconFileName);

        // Skip if the icon already exists
        if (fs.existsSync(srcIconPath)) {
            console.log(`Icon ${iconFileName} already exists, skipping.`);
            return;
        }

        // Create a placeholder icon (SVG format for simplicity)
        createPlaceholderIcon(srcIconPath, parseInt(size, 10), baseColor);
    });

    console.log("All placeholder icons created successfully!");
} else {
    console.warn("No icons defined in manifest.json action.default_icon.");
}
