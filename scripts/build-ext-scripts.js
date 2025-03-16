/**
 * Script to compile the content and background scripts for Chrome extension
 */
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const sourceDir = path.resolve(__dirname, "..");
const distDir = path.resolve(sourceDir, "dist/ai-studio-extended");

const slim = process.argv.includes("slim");
if (slim) {
    console.log("Slim build");
    // Delete dist directory, starting fresh
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
    }
}

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Compile scripts
console.log("Compiling scripts...");
for (const file of ["background.ts", "content-script.ts", "api/auth.ts", "api/new-prompt.ts"]) {
    const outputDir = path.resolve(distDir, path.dirname(file));
    const filePath = path.resolve(sourceDir, "src", file);
    exec(
        `npx tsc --outDir "${outputDir}" --target ES2022 --module ES2022 --moduleResolution node "${filePath}"`,
        (error, stdout, stderr) => {
            if (error) {
                console.error(`Error compiling ${file}: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
            console.log(`${file} compiled successfully`);
        }
    );
}
