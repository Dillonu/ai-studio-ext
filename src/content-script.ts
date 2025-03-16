/**
 * Content script that runs in the context of AI Studio web pages
 */

// Global variables for the import dialog elements
let overlayContainer: HTMLElement | null = null;
let dialogContainer: HTMLElement | null = null;
let isImportDialogOpen = false;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getInfo") {
        // Extract information from the AI Studio page
        const info = {
            title: document.title,
            url: window.location.href,
            // Add more AI Studio specific data extraction here
        };

        sendResponse(info);
    } else if (message.action === "toggleImportDialog") {
        // Show/hide the import dialog when the extension icon is clicked
        showImportDialog();
        sendResponse({ success: true });
    }

    // Required for async response
    return true;
});

/**
 * Initializes the content script
 */
function initialize(): void {
    console.debug("AI Studio Extension content script initialized");

    // Add any page initialization here
    injectImportButton();
    createImportDialog(); // Create the dialog on initialization (but keep it hidden)
}

/**
 * Injects the "Import Prompt" button into the navigation bar
 * below the "Create Prompt" button
 */
function injectImportButton(): void {
    // First try to find the button
    let createPromptElement = null;
    const navList = document.querySelector(".nav-list");

    if (navList) {
        for (let i = 0; i < navList.children.length; i++) {
            const el = navList.children[i];
            if (el.textContent && el.textContent.toLowerCase().includes("create prompt")) {
                createPromptElement = el;
                break;
            }
        }
    }

    // If we found the Create Prompt button, inject our Import button after it
    if (createPromptElement) {
        injectButton(createPromptElement);
    } else {
        // If not found yet, set up a mutation observer specifically for this
        const navObserver = new MutationObserver((mutations, observer) => {
            const navList = document.querySelector(".nav-list");
            if (navList) {
                for (let i = 0; i < navList.children.length; i++) {
                    const el = navList.children[i];
                    if (el.textContent && el.textContent.toLowerCase().includes("create prompt")) {
                        injectButton(el);
                        observer.disconnect(); // Stop observing once button is injected
                        break;
                    }
                }
            }
        });

        // Start observing for the nav list
        navObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }
}

/**
 * Creates and injects the Import Prompt button after the specified element
 *
 * @param {Element} targetElement - The element after which to inject the button
 */
function injectButton(targetElement: Element): void {
    // Clone the target element to maintain styling and structure
    const importButton = targetElement.cloneNode(true) as Element;

    // Update the href attribute in the anchor tag
    const anchorElement = importButton.querySelector("a");
    if (anchorElement) {
        anchorElement.setAttribute("href", "/prompts/import");
        anchorElement.setAttribute("aria-label", "Import Prompt");

        // Remove active class if present
        anchorElement.classList.remove("active");
    }

    // Update the text content in the nav-item-text-wrapper div
    const textWrapper = importButton.querySelector(".nav-item-text-wrapper");
    if (textWrapper) {
        textWrapper.textContent = "Import Prompt";
    }

    // Optionally update the icon to a more appropriate one for import
    const iconSpan = importButton.querySelector(".material-symbols-outlined");
    if (iconSpan) {
        iconSpan.textContent = "file_upload"; // Using a more appropriate icon for import
    }

    // Add click event listener for the import functionality
    importButton.addEventListener("click", (e) => {
        // Prevent default navigation
        e.preventDefault();
        if (anchorElement) {
            e.stopPropagation();
            // Show the import dialog
            showImportDialog();
        }
    });

    // Insert after the Create Prompt button
    targetElement.parentNode?.insertBefore(importButton, targetElement.nextSibling);

    console.debug("Import Prompt button injected successfully");
}

/**
 * Creates the import dialog but keeps it hidden
 */
function createImportDialog(): void {
    let promptName = "Imported Prompt";

    // Add styles
    const styleId = "ai-studio-import-dialog-styles";

    // Only add styles if they don't already exist
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            .ai-studio-import-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                display: none; /* Hidden by default */
            }

            .ai-studio-import-dialog {
                background-color: var(--mat-app-background-color);
                border-radius: 8px;
                width: fit-content;
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
                position: relative;
                box-shadow: 0 11px 15px -7px rgba(0,0,0,.2),
                            0 24px 38px 3px rgba(0,0,0,.14),
                            0 9px 46px 8px rgba(0,0,0,.12);
            }

            .import-dialog-title {
                padding: 16px 24px;
                margin: 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--color-neutral-90);
                font-size: 18px;
                font-weight: 500;
                user-select: none;
            }

            .close-button {
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px;
                user-select: none;
            }

            .import-dialog-content {
                padding: 24px;
            }

            .import-dialog-intro {
                margin-bottom: 16px;
                font-size: 16px;
            }

            .import-dialog-intro ul {
                margin-top: 8px;
                margin-bottom: 8px;
                padding-left: 24px;
            }

            .import-dialog-intro a {
                color: var(--color-primary-70);
                text-decoration: none;
            }

            .import-dialog-intro a:hover {
                text-decoration: underline;
            }

            .import-dialog-tabs {
                display: flex;
                margin-bottom: 16px;
                border-bottom: 1px solid var(--color-neutral-90);
            }

            .import-tab {
                padding: 8px 16px;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s ease;
                user-select: none;
            }

            .import-tab.active {
                border-bottom: 2px solid var(--color-primary-70);
                color: var(--color-primary-70);
            }

            .import-tab.active:hover {
                color: var(--color-primary-60);
            }

            .import-tab-content {
                min-width: min(800px, 80vw);
                width: 100%;
                max-width: 80vw;
                min-height: min(300px, 50vh);
                max-height: 50vh;
            }

            .import-json-textarea {
                min-width: min(800px, 80vw);
                width: 100%;
                max-width: 80vw;
                min-height: min(300px, 50vh);
                max-height: 50vh;
                padding: 12px;
                border-radius: 4px;
                font-family: monospace;
                resize: both;
                background: var(--color-neutral-10) !important;
                color: var(--color-neutral-90) !important;
                border: 1px solid var(--color-neutral-80) !important;
            }

            .import-json-textarea::placeholder {
                user-select: none;
            }

            .import-json-textarea:not(:hover) {
                border: 1px solid var(--color-neutral-80) !important;
            }

            .import-json-textarea:hover {
                background: color-mix(in srgb, var(--color-neutral-10) 50%, var(--color-neutral-20)) !important;
                border: 1px solid var(--color-primary-30) !important;
            }

            .import-file-drop-area {
                border: 2px dashed var(--color-neutral-80);
                background: var(--color-neutral-10) !important;
                color: var(--color-neutral-90) !important;
                border-radius: 0.5em;
                padding: 40px;
                text-align: center;
                cursor: pointer;
                min-height: 120px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                transition: border-color 0.2s ease;
                user-select: none;
            }

            .import-file-drop-area:hover {
                background: color-mix(in srgb, var(--color-neutral-10) 50%, var(--color-neutral-20)) !important;
                border-color: var(--color-primary-30);
            }

            .file-info-content {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px;
                border: 1px solid var(--color-neutral-80);
                border-radius: 4px;
                background-color: var(--color-neutral-10);
                margin-top: 8px;
                cursor: pointer;
                user-select: none;
            }

            .file-info-content:hover {
                background-color: color-mix(in srgb, var(--color-neutral-10) 50%, var(--color-neutral-20)) !important;
            }

            .import-actions {
                margin-top: 24px;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                flex-wrap: wrap;
                align-items: center;
            }

            .import-button {
                background-color: var(--color-primary-50);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }

            .import-button:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }

            .import-button:not(:disabled):hover {
                background-color: var(--color-primary-60);
            }

            .cancel-button {
                background-color: transparent;
                border: 1px solid var(--color-neutral-80);
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }

            .cancel-button:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }

            .cancel-button:not(:disabled):hover {
                background-color: var(--color-neutral-10);
            }

            .import-validation-error {
                background-color: var(--color-error-tooltip-background);//rgba(217, 48, 37, 0.1);
                border: 1px solid var(--color-error-tooltip);//#d93025;
                border-radius: 4px;
                color: var(--color-error-tooltip);//#d93025;
                margin: 0;
                padding: 8px 12px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-grow: 1;
                margin-right: 16px;
                min-height: 36px;
                order: -1; /* Ensures it appears before the buttons */
            }

            .import-validation-warning {
                background-color: hsl(from var(--color-error-tooltip-background) calc(h + 40) s l);
                border: 1px solid hsl(from var(--color-error-tooltip) calc(h + 40) s l);
                border-radius: 4px;
                color: hsl(from var(--color-error-tooltip) calc(h + 40) s l);
                margin: 0;
                padding: 8px 12px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-grow: 1;
                margin-right: 16px;
                min-height: 36px;
                order: -1; /* Ensures it appears before the buttons */
            }

            .import-validation-info {
                background-color: hsl(from var(--color-error-tooltip-background) calc(h + 225) s l);
                border: 1px solid hsl(from var(--color-error-tooltip) calc(h + 225) s l);
                border-radius: 4px;
                color: hsl(from var(--color-error-tooltip) calc(h + 225) s l);
                margin: 0;
                padding: 8px 12px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-grow: 1;
                margin-right: 16px;
                min-height: 36px;
                order: -1; /* Ensures it appears before the buttons */
            }

            .import-validation-success {
                background-color: hsl(from var(--color-error-tooltip-background) calc(h + 120) s l);
                border: 1px solid hsl(from var(--color-error-tooltip) calc(h + 120) s l);
                border-radius: 4px;
                color: hsl(from var(--color-error-tooltip) calc(h + 120) s l);
                margin: 0;
                padding: 8px 12px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-grow: 1;
                margin-right: 16px;
                min-height: 36px;
                order: -1; /* Ensures it appears before the buttons */
            }

            .import-validation-error::before {
                content: "error";
                font-family: 'Material Symbols Outlined';
                font-size: 18px;
            }

            .import-validation-warning::before {
                content: "warning";
                font-family: 'Material Symbols Outlined';
                font-size: 18px;
            }

            .import-validation-info::before {
                content: "info";
                font-family: 'Material Symbols Outlined';
                font-size: 18px;
            }

            .import-validation-success::before {
                content: "check_circle";
                font-family: 'Material Symbols Outlined';
                font-size: 18px;
            }
        `;
        document.head.appendChild(style);
    }

    // Create the overlay container
    overlayContainer = document.createElement("div");
    overlayContainer.className = "ai-studio-import-dialog-overlay";
    document.body.appendChild(overlayContainer);

    // Create the dialog container
    dialogContainer = document.createElement("div");
    dialogContainer.className = "ai-studio-import-dialog";
    overlayContainer.appendChild(dialogContainer);

    // Create dialog content
    const dialogContent = `
        <h2 class="import-dialog-title">
            Import Prompt
            <button class="close-button">
                <span aria-hidden="true" class="material-symbols-outlined notranslate">close</span>
            </button>
        </h2>
        <div class="import-dialog-content">
            <div class="import-dialog-intro">
                Paste your prompt JSON or upload a file compatible with:
                <ul>
                    <li><a href="https://ai.google.dev/api/generate-content#method:-models.generatecontent">Gemini API (models.generateContent format)</a></li>
                    <li><a href="https://aistudio.google.com/library">AI Studio Prompt Library</a></li>
                </ul>
            </div>
            <div class="import-dialog-tabs">
                <div class="import-tab active" data-tab="json">JSON Input</div>
                <div class="import-tab" data-tab="file">File Upload</div>
            </div>
            <div class="import-tab-content" id="json-tab">
                <textarea class="import-json-textarea" placeholder="Paste your prompt JSON here"></textarea>
            </div>
            <div class="import-tab-content" id="file-tab" style="display: none;">
                <div class="import-file-drop">
                    <input type="file" id="import-file-input" accept=".json" style="display: none;" />
                    <div class="import-file-drop-area">
                        <span class="material-symbols-outlined notranslate">upload_file</span>
                        <p>Drop your file here or click to browse</p>
                    </div>
                </div>
                <div class="import-file-info" style="display: none;"></div>
            </div>
            <div class="import-actions">
                <div id="import-validation-error" class="import-validation-error" style="display: none;"></div>
                <button class="import-button">Import</button>
                <button class="cancel-button">Cancel</button>
            </div>
        </div>
    `;
    dialogContainer.innerHTML = dialogContent;

    // Set up event handlers
    setupDialogEventHandlers();
}

/**
 * Sets up all event handlers for the import dialog
 */
function setupDialogEventHandlers(): void {
    if (!overlayContainer || !dialogContainer) return;

    let isLoading = false;
    let promptName = "Imported Prompt";

    // Function to validate textarea content
    function validateTextarea(): boolean {
        const jsonTextarea = dialogContainer!.querySelector(".import-json-textarea") as HTMLTextAreaElement;
        const errorDiv = dialogContainer!.querySelector("#import-validation-error") as HTMLElement;

        if (!jsonTextarea) return false;

        const value = jsonTextarea.value.trim();

        // Check if textarea is empty
        if (!value) {
            if (errorDiv) {
                errorDiv.textContent = "Please enter JSON data to import.";
                errorDiv.style.display = "flex";
                errorDiv.classList.remove(
                    "import-validation-error",
                    "import-validation-success",
                    "import-validation-info"
                );
                errorDiv.classList.add("import-validation-warning");
            }
            return false;
        }

        // Check if textarea contains parsable JSON
        let parsedJson;
        try {
            parsedJson = JSON.parse(value);
        } catch (e) {
            if (errorDiv) {
                errorDiv.textContent = "Invalid JSON format. Please check your input.";
                errorDiv.style.display = "flex";
                errorDiv.classList.remove(
                    "import-validation-info",
                    "import-validation-success",
                    "import-validation-warning"
                );
                errorDiv.classList.add("import-validation-error");
            }
            return false;
        }

        // Check if content can be converted via convertPromptData
        try {
            const convertedData = (window as any).convertPromptData(promptName, parsedJson);
            if (!convertedData) {
                if (errorDiv) {
                    errorDiv.textContent = "This JSON format is not recognized as a valid prompt.";
                    errorDiv.style.display = "flex";
                    errorDiv.classList.remove(
                        "import-validation-info",
                        "import-validation-success",
                        "import-validation-warning"
                    );
                    errorDiv.classList.add("import-validation-error");
                }
                return false;
            }
        } catch (e) {
            console.debug("Error converting prompt data:", e);
            if (errorDiv) {
                errorDiv.textContent = "Error processing JSON data. The format may not be supported.";
                errorDiv.style.display = "flex";
                errorDiv.classList.remove(
                    "import-validation-info",
                    "import-validation-success",
                    "import-validation-warning"
                );
                errorDiv.classList.add("import-validation-error");
            }
            return false;
        }

        // If validation passed, show success message
        if (errorDiv) {
            errorDiv.textContent = "Valid prompt format. Ready to import!";
            errorDiv.style.display = "flex";
            errorDiv.classList.remove("import-validation-info", "import-validation-error", "import-validation-warning");
            errorDiv.classList.add("import-validation-success");
        }

        return true;
    }

    // Close dialog when clicking on the overlay, but only if the mouse down also started on the overlay
    let mouseDownOnOverlay = false;
    let mouseDownOnDialog = false;

    overlayContainer.addEventListener("mousedown", (e) => {
        mouseDownOnOverlay = e.target === overlayContainer;
        mouseDownOnDialog = dialogContainer?.contains(e.target as Node) || false;
    });

    overlayContainer.addEventListener("click", (e) => {
        // Only close if both mousedown and click happened on the overlay
        // and the mousedown did not start on the dialog
        if (e.target === overlayContainer && mouseDownOnOverlay && !mouseDownOnDialog) {
            closeDialog();
        }
    });

    // Close dialog when clicking the close button
    const closeButton = dialogContainer.querySelector(".close-button") as HTMLButtonElement;
    if (closeButton) {
        closeButton.addEventListener("click", closeDialog);
    }

    // Cancel button closes the dialog
    const cancelButton = dialogContainer.querySelector(".cancel-button") as HTMLButtonElement;
    if (cancelButton) {
        cancelButton.addEventListener("click", closeDialog);
    }

    // Tab switching functionality
    const tabs = dialogContainer.querySelectorAll(".import-tab") as NodeListOf<HTMLElement>;
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener("click", function () {
            // Hide all tab contents
            const tabContents = dialogContainer!.querySelectorAll(".import-tab-content");
            for (let j = 0; j < tabContents.length; j++) {
                (tabContents[j] as HTMLElement).style.display = "none";
            }

            // Remove active class from all tabs
            for (let j = 0; j < tabs.length; j++) {
                tabs[j].classList.remove("active");
            }

            // Show selected tab and set active
            const tab = tabs[i] as HTMLElement;
            tab.classList.add("active");
            const tabId = tab.getAttribute("data-tab");
            const tabContent = dialogContainer!.querySelector(`#${tabId}-tab`);
            if (tabContent) {
                (tabContent as HTMLElement).style.display = "block";
            }
        });
    }

    // File drop functionality
    const fileDropArea = dialogContainer.querySelector(".import-file-drop-area") as HTMLElement;
    const fileInput = dialogContainer.querySelector("#import-file-input") as HTMLInputElement;
    const fileInfo = dialogContainer.querySelector(".import-file-info") as HTMLElement;

    if (fileDropArea && fileInput && fileInfo) {
        fileDropArea.addEventListener("click", () => {
            fileInput.click();
        });

        fileDropArea.addEventListener("dragover", (e) => {
            e.preventDefault();
            (fileDropArea as HTMLElement).style.borderColor = "#1a73e8";
        });

        fileDropArea.addEventListener("dragleave", () => {
            (fileDropArea as HTMLElement).style.borderColor = "#ccc";
        });

        fileDropArea.addEventListener("drop", (e) => {
            e.preventDefault();
            (fileDropArea as HTMLElement).style.borderColor = "#ccc";

            const dragEvent = e as DragEvent;
            if (dragEvent.dataTransfer && dragEvent.dataTransfer.files && dragEvent.dataTransfer.files.length > 0) {
                handleFile(dragEvent.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files.length) {
                handleFile(fileInput.files[0]);
            }
        });

        function handleFile(file: File) {
            if (file.type === "application/json" || file.name.endsWith(".json")) {
                promptName = file.name;
                (fileInfo as HTMLElement).innerHTML = `
                    <div class="file-info-content">
                        <span class="material-symbols-outlined notranslate">description</span>
                        <span>${file.name} (${formatFileSize(file.size)})</span>
                    </div>
                `;
                (fileInfo as HTMLElement).style.display = "block";
                (fileDropArea as HTMLElement).style.display = "none";

                // Read file
                const reader = new FileReader();
                reader.onload = (event) => {
                    const jsonTextarea = dialogContainer!.querySelector(".import-json-textarea") as HTMLTextAreaElement;
                    if (jsonTextarea && event.target && typeof event.target.result === "string") {
                        jsonTextarea.value = event.target.result;
                        tabs[0].click();

                        // Validate textarea content after loading file
                        const importButton = dialogContainer!.querySelector(".import-button") as HTMLButtonElement;
                        if (importButton) {
                            importButton.disabled = !validateTextarea();
                        }
                    }
                };
                reader.readAsText(file);
            } else {
                alert("Please upload a JSON file.");
            }
        }

        // Add click handler to the file info area to allow resetting the file selection
        fileInfo.addEventListener("click", () => {
            // Reset the file input value
            fileInput.value = "";
            // Hide file info and show drop area again
            fileInfo.style.display = "none";
            fileDropArea.style.display = "flex";
            // Open the file dialog
            fileInput.click();
        });

        function formatFileSize(bytes: number): string {
            if (bytes < 1024) return bytes + " bytes";
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
            return (bytes / (1024 * 1024)).toFixed(1) + " MB";
        }
    }

    // Import button functionality
    const importButton = dialogContainer.querySelector(".import-button") as HTMLButtonElement;
    const jsonTextarea = dialogContainer.querySelector(".import-json-textarea") as HTMLTextAreaElement;

    if (importButton && jsonTextarea) {
        // Disable the import button by default
        importButton.disabled = true;

        // Add input event listener to textarea
        jsonTextarea.addEventListener("input", () => {
            importButton.disabled = !validateTextarea();
        });

        // Add event listener when file is loaded
        // This is needed because the file content is loaded asynchronously
        jsonTextarea.addEventListener("change", () => {
            importButton.disabled = !validateTextarea();
        });

        importButton.addEventListener("click", () => {
            if (jsonTextarea && jsonTextarea.value.trim()) {
                try {
                    if (isLoading) return;
                    isLoading = true;
                    // Disable controls
                    if (importButton instanceof HTMLButtonElement) {
                        importButton.disabled = true;
                        importButton.textContent = "Importing...";
                    }
                    if (cancelButton) cancelButton.disabled = true;

                    // Function to re-enable controls
                    const enableControls = () => {
                        if (importButton instanceof HTMLButtonElement) {
                            importButton.disabled = !validateTextarea();
                            importButton.textContent = "Import";
                        }
                        if (cancelButton) cancelButton.disabled = false;
                        isLoading = false;
                    };

                    const promptData = JSON.parse(jsonTextarea.value);
                    console.debug("Importing prompt:", promptData);

                    // Use the global version of createMakerSuitePrompt
                    try {
                        (window as any).createMakerSuitePrompt(
                            promptName,
                            promptData,
                            (responseText: string) => {
                                console.debug("Prompt created successfully:", responseText);
                                try {
                                    const json = JSON.parse(responseText);
                                    // Update the URL without reloading the page
                                    history.pushState({}, "", json[0]);
                                    // Dispatch a popstate event to trigger angular router to execute component
                                    window.dispatchEvent(new PopStateEvent("popstate"));
                                } catch (e) {
                                    console.error("Failed to parse prompt:", e);
                                    alert("Failed to create prompt. Error: " + e);
                                }

                                // Close dialog after successful import
                                enableControls(); // Re-enable on error
                                closeDialog();
                            },
                            (status: number | string, statusText: string | null) => {
                                console.error("Failed to create prompt:", status, statusText);
                                alert("Failed to create prompt.\nError: " + status + " " + statusText);

                                // Close dialog after successful import
                                enableControls(); // Re-enable on error
                                closeDialog();
                            }
                        );
                    } catch (e) {
                        console.error("Failed to create prompt:", e);
                        alert("Failed to create prompt. Error: " + e);

                        // Close dialog after successful import
                        enableControls(); // Re-enable on error
                        closeDialog();
                    }
                } catch (e) {
                    alert("Invalid JSON format. Please check your input.");
                }
            } else {
                alert("Please enter JSON data to import.");
            }
        });
    }
}

/**
 * Shows the import dialog
 */
function showImportDialog(): void {
    if (isImportDialogOpen || !overlayContainer) return;

    // Reset the dialog state
    const fileDropArea = overlayContainer.querySelector(".import-file-drop-area") as HTMLElement;
    const fileInfo = overlayContainer.querySelector(".import-file-info") as HTMLElement;
    const jsonTextarea = overlayContainer.querySelector(".import-json-textarea") as HTMLTextAreaElement;
    const importButton = overlayContainer.querySelector(".import-button") as HTMLButtonElement;
    const errorDiv = overlayContainer.querySelector("#import-validation-error") as HTMLElement;

    // Reset file upload tab
    if (fileDropArea) fileDropArea.style.display = "flex";
    if (fileInfo) {
        fileInfo.style.display = "none";
        fileInfo.innerHTML = "";
    }

    // Reset JSON tab
    if (jsonTextarea) jsonTextarea.value = "";
    if (importButton) importButton.disabled = true;

    // Reset error message
    if (errorDiv) {
        errorDiv.style.display = "none";
        errorDiv.classList.remove("import-validation-info");
        errorDiv.classList.remove("import-validation-error");
        errorDiv.classList.remove("import-validation-success");
        errorDiv.classList.remove("import-validation-warning");
        errorDiv.classList.add("import-validation-error");
    }

    // Ensure JSON tab is active by default
    const jsonTab = overlayContainer.querySelector('.import-tab[data-tab="json"]') as HTMLElement;
    if (jsonTab) {
        const tabs = overlayContainer.querySelectorAll(".import-tab");
        tabs.forEach((tab) => tab.classList.remove("active"));
        jsonTab.classList.add("active");

        // Show JSON tab content, hide other tab contents
        overlayContainer.querySelectorAll(".import-tab-content").forEach((content) => {
            (content as HTMLElement).style.display = "none";
        });
        const jsonTabContent = overlayContainer.querySelector("#json-tab") as HTMLElement;
        if (jsonTabContent) jsonTabContent.style.display = "block";
    }

    // Show the dialog
    overlayContainer.style.display = "flex";
    isImportDialogOpen = true;
}

/**
 * Closes the import dialog
 */
function closeDialog(): void {
    if (!overlayContainer) return;

    // Hide the dialog
    overlayContainer.style.display = "none";
    isImportDialogOpen = false;
}

// Initialize when the document is fully loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    initialize();
}
