const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

/**
 * Icon sizes needed for PWA
 * @type {number[]}
 */
const ICON_SIZES = [16, 48, 48, 128];

/**
 * Source SVG file path
 * @type {string}
 */
const SOURCE_SVG = path.join(__dirname, "../src/assets/icons/icon.svg");
const MASKABLE_SVG = fs.readFileSync(SOURCE_SVG, "utf8").replace(/<circle.+\/>/, "");

/**
 * Output directory for generated icons
 * @type {string}
 */
const OUTPUT_DIR = path.join(__dirname, "../src/assets/icons");

/**
 * Ensures the output directory exists
 */
function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}

/**
 * Generates a PNG icon of specified size from the source SVG
 * @param {number} size - The size of the icon to generate
 * @param {'maskable'|'any'|'monochrome'} purpose - The purpose of the icon
 * @returns {Promise<void>}
 */
async function generateIcon(size, purpose) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}-${purpose}.png`);
    console.log(`Generating ${size}x${size} ${purpose} icon...`);

    try {
        const widthIcon = Math.round(size * 0.8);
        const heightIcon = Math.round(size * 0.8);
        const leftPadding = Math.round((size - widthIcon) / 2);
        const topPadding = Math.round((size - heightIcon) / 2);
        // First resize with padding for proper layout
        let pipeline = sharp(purpose === "any" ? SOURCE_SVG : Buffer.from(MASKABLE_SVG))
            .resize(Math.round(size * 0.8), Math.round(size * 0.8), {
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .extend({
                top: topPadding,
                bottom: size - heightIcon - topPadding,
                left: leftPadding,
                right: size - widthIcon - leftPadding,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            });

        if (purpose === "monochrome") {
            // Convert to grayscale and increase contrast for better monochrome appearance
            pipeline = pipeline
                .grayscale()
                .linear(1.5, -(240 * 1.5) + 240) // Increase contrast
                .threshold(240); // Convert to pure black and white
        }

        await pipeline.png().toFile(outputPath);
        console.log(`Generated ${outputPath}`);
    } catch (error) {
        console.error(`Error generating ${size}x${size}-${purpose} icon:`, error);
    }
}

/**
 * Main function to generate all icons
 */
async function main() {
    console.log("Starting icon generation...");
    ensureOutputDir();

    try {
        // Generate all versions of icons for each size
        for (const size of ICON_SIZES) {
            await Promise.all([
                //generateIcon(size, 'maskable'),
                generateIcon(size, "any"),
                //generateIcon(size, 'monochrome')
            ]);
        }

        console.log("Icon generation complete!");
    } catch (error) {
        console.error("Error during icon generation:", error);
        process.exit(1);
    }
}

// Run the script
main();
