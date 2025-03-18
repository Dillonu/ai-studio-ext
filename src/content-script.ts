/**
 * Content script that runs in the context of AI Studio web pages
 */

// Global variables for the import dialog elements
let overlayContainer: HTMLElement | null = null;
let dialogContainer: HTMLElement | null = null;
let isImportDialogOpen = false;

// Status constants
const STATUS = {
    OPERATIONAL: "check_circle",
    PARTIAL_OUTAGE: "warning",
    TOTAL_OUTAGE: "report",
    PENDING: "pending",
    ERROR: "error",
};

// Status-related global variables
const STATUS_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
let currentStatusIconName = STATUS.PENDING; // Default icon is now pending

// Platform identifiers in the API response
const PLATFORM = {
    API: 1,
    MULTIMODAL_LIVE_API: 2,
    GOOGLE_AI_STUDIO: 3,
};

// Platform names for display
const PLATFORM_NAMES: Record<number, string> = {
    1: "Gemini API",
    2: "Multimodal Live API",
    3: "Google AI Studio",
};

// Incident status identifiers in the API response
const INCIDENT_STATUS = {
    DETECTED: 1,
    IDENTIFIED: 2,
    MITIGATED: 3,
    RESOLVED: 4,
};
const INCIDENT_STATUS_NAMES: Record<number, keyof typeof INCIDENT_STATUS> = {
    [INCIDENT_STATUS.DETECTED]: "DETECTED",
    [INCIDENT_STATUS.IDENTIFIED]: "IDENTIFIED",
    [INCIDENT_STATUS.MITIGATED]: "MITIGATED",
    [INCIDENT_STATUS.RESOLVED]: "RESOLVED",
};

// Outage severity identifiers in the API response
const OUTAGE_SEVERITY = {
    PARTIAL: 1,
    // Anything other than 1 is considered a total outage
};

// Storing tooltip elements globally
let statusTooltipElement: HTMLElement | null = null;
let statusTooltipContainer: HTMLElement | null = null;

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
    injectStatusButton();
    createImportDialog(); // Create the dialog on initialization (but keep it hidden)

    // Check status initially and then at regular intervals
    checkAndUpdateStatus();
    setInterval(checkAndUpdateStatus, STATUS_CHECK_INTERVAL);
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
        textWrapper.classList.add("ai-studio-ext-button-text");
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
 * Injects the "AI Studio Status" button into the navigation bar
 * in the external links section after the Changelog item
 */
function injectStatusButton(): void {
    // First try to find the external links section
    const navList = document.querySelector(".nav-list .external-links");

    if (navList) {
        // Try to find the Changelog item
        let changelogElement = null;

        for (let i = 0; i < navList.children.length; i++) {
            const el = navList.children[i];
            if (el.textContent && el.textContent.toLowerCase().includes("changelog")) {
                changelogElement = el;
                break;
            }
        }

        // If we found the Changelog item, inject our Status button after it
        if (changelogElement) {
            injectStatusLink(changelogElement);
        } else {
            // If not found yet, set up a mutation observer
            const navObserver = new MutationObserver((mutations, observer) => {
                const navList = document.querySelector(".nav-list .external-links");
                if (navList) {
                    // Set flex to 0 to fix click area issues:
                    (navList as HTMLElement).style.flex = "0";
                    // Loop through all children to add status link:
                    for (let i = 0; i < navList.children.length; i++) {
                        const el = navList.children[i];
                        if (el.textContent && el.textContent.toLowerCase().includes("changelog")) {
                            injectStatusLink(el);
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
    } else {
        // If external links section not found yet, set up a mutation observer
        const bodyObserver = new MutationObserver((mutations, observer) => {
            const navList = document.querySelector(".nav-list .external-links");
            if (navList) {
                let changelogElement = null;

                for (let i = 0; i < navList.children.length; i++) {
                    const el = navList.children[i];
                    if (el.textContent && el.textContent.toLowerCase().includes("changelog")) {
                        changelogElement = el;
                        break;
                    }
                }

                if (changelogElement) {
                    injectStatusLink(changelogElement);
                    observer.disconnect(); // Stop observing once button is injected
                }
            }
        });

        // Start observing for the external links section
        bodyObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }
}

/**
 * Creates and injects the AI Studio Status link after the specified element
 *
 * @param {Element} targetElement - The element after which to inject the status link
 */
function injectStatusLink(targetElement: Element): void {
    // Clone the target element to maintain styling and structure
    const statusLink = targetElement.cloneNode(true) as Element;

    // Update the href attribute in the anchor tag
    const anchorElement = statusLink.querySelector("a");
    if (anchorElement) {
        anchorElement.setAttribute("href", "https://aistudio.google.com/status");
        anchorElement.setAttribute("aria-label", "AI Studio Status");
        anchorElement.setAttribute("target", "_blank"); // Open in new tab

        // Remove active class if present
        anchorElement.classList.remove("active");
    }

    // Update the text content in the nav-item-text-wrapper div
    const textWrapper = statusLink.querySelector(".nav-item-text-wrapper");
    if (textWrapper) {
        textWrapper.textContent = "Status";
        textWrapper.classList.add("ai-studio-ext-button-text");

        // Remove any NEW badge if it exists
        const newBadge = textWrapper.querySelector(".new-badge");
        if (newBadge) {
            newBadge.remove();
        }
    }

    // Update the icon to a more appropriate one for status
    const iconSpan = statusLink.querySelector(".material-symbols-outlined");
    if (iconSpan) {
        iconSpan.textContent = currentStatusIconName; // Using an appropriate icon for status
        iconSpan.id = "ai-studio-status-icon"; // Add an ID so we can update it later
    }

    // Insert after the target element
    targetElement.parentNode?.insertBefore(statusLink, targetElement.nextSibling);

    console.debug("AI Studio Status link injected successfully");

    // Add tooltip styles to the document if they don't exist
    addTooltipStyles();

    // Create the tooltip in the body
    createStatusTooltip();

    // Add mouse events to the status link
    if (statusLink) {
        statusLink.addEventListener("mouseenter", showStatusTooltip);
        statusLink.addEventListener("mouseleave", hideStatusTooltip);
    }
}

/**
 * Adds tooltip styles to the document
 */
function addTooltipStyles(): void {
    const styleId = "ai-studio-status-tooltip-styles";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            .ai-studio-ext-button-text {
                opacity: 1;
                transition: opacity 0.3s ease-in-out, width 0.3s ease-in-out;
                white-space: nowrap;
                overflow: hidden;
                display: inline-block;
                max-width: 100%;
            }

            /* Hide text in buttons when navbar is collapsed */
            .layout-navbar.collapsed .ai-studio-ext-button-text {
                opacity: 0;
                max-width: 0;
            }

            .ai-studio-status-tooltip {
                position: fixed;
                border-radius: 6px;
                z-index: 10001;
                pointer-events: none;
                user-select: none;
                opacity: 0;
                /* Allow transform to be set dynamically while keeping the scale effect */
                transform: scale(0.5);
                transition: opacity 0.1s ease-in-out, transform 0.1s ease-in-out;
            }

            .ai-studio-status-tooltip > .mat-mdc-tooltip {
                width: fit-content;
                max-width: 80vw;
                max-height: calc(100vh - 150px);
                overflow-y: auto;
                border-radius: var(--mdc-plain-tooltip-container-shape, var(--mat-sys-corner-extra-small));
                background-color: var(--mdc-plain-tooltip-container-color, var(--mat-sys-inverse-surface));
                padding: 12px;
                white-space: normal;
            }

            .status-tooltip-title {
                font-weight: 500;
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .status-tooltip-title .status-icon {
                font-family: 'Material Symbols Outlined';
                font-size: 16px;
            }

            /* Status icon colors */
            .status-tooltip-title.operational .status-icon,
            .status-platform-title .status-icon.operational {
                color: hsl(from var(--color-error-tooltip) calc(h + 120) s l);
            }

            .status-tooltip-title.partial .status-icon,
            .status-platform-title .status-icon.partial {
                color: hsl(from var(--color-error-tooltip) calc(h + 40) s l);
            }

            .status-tooltip-title.total .status-icon,
            .status-platform-title .status-icon.total {
                color: var(--color-error-tooltip);
            }

            /* Style for the actual status button icon */
            #ai-studio-status-icon.operational {
                color: hsl(from var(--color-error-tooltip) calc(h + 120) s l);
            }

            #ai-studio-status-icon.partial {
                color: hsl(from var(--color-error-tooltip) calc(h + 40) s l);
            }

            #ai-studio-status-icon.total {
                color: var(--color-error-tooltip);
            }

            #ai-studio-status-icon {
                font-family: 'Material Symbols Outlined';
            }

            .status-platform-section:not(:last-child) {
                margin-bottom: 12px;
            }

            .status-platform-section ul {
                margin-left: 1em;
            }

            .status-platform-title {
                font-weight: 500;
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .status-platform-title .status-icon {
                font-family: 'Material Symbols Outlined';
                font-size: 16px;
            }

            .status-incident-list {
                margin: 0;
                padding-left: 20px;
            }

            .status-incident-item {
                margin-bottom: 8px;
            }

            .status-incident-name {
                font-weight: 500;
            }

            .status-incident-description {
                margin-top: 2px;
                font-size: 12px;
                opacity: 0.9;
            }

            .status-incident-time {
                margin-top: -0.5em;
                font-size: 11px;
                opacity: 0.8;
                font-style: italic;
            }

            .status-no-incidents {
                font-style: italic;
                opacity: 0.7;
            }

            @media screen and (max-height: 600px) {
                .ai-studio-status-tooltip {
                    max-height: calc(100vh - 100px);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Creates the status tooltip element and appends it to the document body
 */
function createStatusTooltip(): void {
    // Only create if it doesn't exist yet
    if (statusTooltipElement === null) {
        // Create outer tooltip container with Material Design class
        const outerTooltip = document.createElement("div");
        outerTooltip.classList.add("gmat-mdc-tooltip");
        outerTooltip.classList.add("ai-studio-status-tooltip");

        // Create inner tooltip content container
        statusTooltipElement = document.createElement("div");
        statusTooltipElement.classList.add("mat-mdc-tooltip");

        // Append inner to outer, and outer to body
        outerTooltip.appendChild(statusTooltipElement);
        document.body.appendChild(outerTooltip);

        // Store reference to outer tooltip for show/hide functions
        statusTooltipContainer = outerTooltip;
    }
}

/**
 * Shows the status tooltip and positions it next to the status icon
 */
async function showStatusTooltip(): Promise<void> {
    if (!statusTooltipElement || !statusTooltipContainer) return;

    // Position the tooltip
    const iconElement = document.getElementById("ai-studio-status-icon")?.parentElement?.parentElement?.parentElement;
    if (iconElement) {
        const iconRect = iconElement.getBoundingClientRect();
        await positionTooltip(statusTooltipContainer, iconRect);

        // Make tooltip visible
        if (statusTooltipContainer) {
            statusTooltipContainer.style.opacity = "1";
            statusTooltipContainer.style.transform = statusTooltipContainer.style.transform.replace(
                "scale(0.5)",
                "scale(1)"
            );
        }
    }
}

/**
 * Hides the status tooltip
 */
function hideStatusTooltip(): void {
    if (statusTooltipContainer) {
        statusTooltipContainer.style.opacity = "";
        // Keep the position/translation but scale down
        statusTooltipContainer.style.transform = statusTooltipContainer.style.transform.replace(
            "scale(1)",
            "scale(0.5)"
        );
    }
}

/**
 * Positions the tooltip relative to the button
 *
 * @param {HTMLElement} tooltip - The tooltip element
 * @param {DOMRect} buttonRect - The button's bounding rectangle
 */
async function positionTooltip(tooltip: HTMLElement, buttonRect: DOMRect): Promise<void> {
    if (!tooltip) return;

    // Default position to the right of the button
    let left = buttonRect.right + 8;
    let top = buttonRect.top + buttonRect.height / 2;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Temporarily disable transitions and set scale to 1 for accurate measurements
    const originalTransition = tooltip.style.transition;
    const originalTransform = tooltip.style.transform;
    const originalOpacity = tooltip.style.opacity;
    tooltip.style.transition = "none";
    tooltip.style.transform = tooltip.style.transform.replace("scale(0.5)", "scale(1)");
    tooltip.style.opacity = "0"; // Keep invisible during measurement

    // Force layout recalculation to apply style changes immediately
    tooltip.offsetHeight;

    // Get actual tooltip dimensions at scale(1)
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    if (!tooltipWidth || !tooltipHeight) {
        // Restore original styles if we can't get dimensions
        tooltip.style.transform = originalTransform;
        tooltip.style.opacity = originalOpacity;
        tooltip.style.transition = originalTransition;
        return;
    }

    // Calculate optimal position and transform
    let transformValue = "translateY(-50%)";
    let transformOrigin = "center left";

    // Check horizontal overflow
    if (left + tooltipWidth > viewportWidth - 20) {
        // Position to the left of the button
        left = buttonRect.left - 8 - tooltipWidth;
        transformOrigin = "center right";
    }

    console.log("tooltipHeight", tooltipHeight);
    console.log("top", top);
    console.log("viewportHeight", viewportHeight);

    // Check if tooltip would go off the top of the screen
    /*if (top - tooltipHeight / 2 < 20) {
        // Position below the top edge with some padding
        const topAdjustment = Math.abs(top - tooltipHeight / 2 - 20);
        transformValue = `translateY(calc(-50% + ${topAdjustment}px))`;
        transformOrigin = `top ${left > buttonRect.left ? "left" : "right"}`;
    }
    // Check if tooltip would go off the bottom of the screen
    else if (top + tooltipHeight / 2 > viewportHeight - 20) {
        // Position above the bottom edge with some padding
        const bottomAdjustment = top + tooltipHeight / 2 - viewportHeight + 20;
        transformValue = `translateY(calc(-50% - ${bottomAdjustment}px))`;
        transformOrigin = `bottom ${left > buttonRect.left ? "left" : "right"}`;
    }*/

    // Apply position and transforms for final placement
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transformOrigin = transformOrigin;
    tooltip.style.transform = transformValue + " scale(0.5)"; // Keep initially scaled down

    return new Promise((resolve) => {
        // Restore the original transition and scale
        setTimeout(() => {
            tooltip.style.opacity = originalOpacity; // Restore original opacity
            tooltip.style.transition = originalTransition;
            resolve();
        }, 50);
    });
}

/**
 * Updates the status tooltip content based on active incidents
 */
function updateStatusTooltip(): void {
    if (!statusTooltipElement) {
        createStatusTooltip();
    }

    if (!statusTooltipElement) return;

    // Determine overall status for title
    let statusTitle = "All Systems Operational";
    let statusTitleClass = "operational";
    let statusTitleIcon = STATUS.OPERATIONAL;

    if (activeIncidents.some((incident) => incident.severity !== OUTAGE_SEVERITY.PARTIAL)) {
        statusTitle = "Service Disruption";
        statusTitleClass = "total";
        statusTitleIcon = STATUS.TOTAL_OUTAGE;
    } else if (activeIncidents.length > 0) {
        statusTitle = "Partial Service Disruption";
        statusTitleClass = "partial";
        statusTitleIcon = STATUS.PARTIAL_OUTAGE;
    }

    // Group incidents by platform
    const platformIncidents: Record<number, ActiveIncidentData[]> = {};
    for (let i = 0; i < activeIncidents.length; i++) {
        const incident = activeIncidents[i];
        const platformId = incident.platformId;

        if (!platformIncidents[platformId]) {
            platformIncidents[platformId] = [];
        }

        platformIncidents[platformId].push(incident);
    }

    // Build tooltip HTML
    let tooltipHtml = `
        <div class="status-tooltip-title ${statusTitleClass}">
            <span class="status-icon">${statusTitleIcon}</span>
            <span>${statusTitle}</span>
        </div>
    `;

    // No active incidents
    if (activeIncidents.length === 0) {
        tooltipHtml += `<div class="status-no-incidents">No active incidents reported.</div>`;
    } else {
        // Add sections for each platform with active incidents
        for (const platformId in platformIncidents) {
            if (platformIncidents.hasOwnProperty(platformId)) {
                const incidents = platformIncidents[Number(platformId)];
                const platformName = PLATFORM_NAMES[Number(platformId)] || `Platform ${platformId}`;

                // Determine platform status icon
                let platformIcon = STATUS.OPERATIONAL;
                let platformIconClass = "operational";
                if (incidents.some((incident: ActiveIncidentData) => incident.severity !== OUTAGE_SEVERITY.PARTIAL)) {
                    platformIcon = STATUS.TOTAL_OUTAGE;
                    platformIconClass = "total";
                } else {
                    platformIcon = STATUS.PARTIAL_OUTAGE;
                    platformIconClass = "partial";
                }

                tooltipHtml += `
                    <div class="status-platform-section">
                        <div class="status-platform-title">
                            <span class="status-icon ${platformIconClass}">${platformIcon}</span>
                            <span>${platformName}</span>
                        </div>
                        <ul class="status-incident-list">
                `;

                for (let i = 0; i < incidents.length; i++) {
                    const incident = incidents[i];
                    tooltipHtml += `
                        <li class="status-incident-item">
                            <div class="status-incident-name">${incident.incidentName}</div>
                            <div class="status-incident-description">
                                ${incident.incidentDescription}
                                <div class="status-incident-time">${formatDate(incident.timestamp)}</div>
                            </div>
                        </li>
                    `;
                }

                tooltipHtml += `
                        </ul>
                    </div>
                `;
            }
        }
    }

    // Set the tooltip content
    statusTooltipElement.innerHTML = tooltipHtml;
}

/**
 * Formats a date string to a more readable format
 *
 * @param {string} dateString - The date string to format
 * @returns {string} The formatted date string
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
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
                color: var(--color-error-tooltip);
            }

            .import-validation-warning::before {
                content: "warning";
                font-family: 'Material Symbols Outlined';
                font-size: 18px;
                color: hsl(from var(--color-error-tooltip) calc(h + 40) s l);
            }

            .import-validation-info::before {
                content: "info";
                font-family: 'Material Symbols Outlined';
                font-size: 18px;
                color: hsl(from var(--color-error-tooltip) calc(h + 225) s l);
            }

            .import-validation-success::before {
                content: "check_circle";
                font-family: 'Material Symbols Outlined';
                font-size: 18px;
                color: hsl(from var(--color-error-tooltip) calc(h + 120) s l);
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
            const convertedData = (window as any).aiStudioExt.convertPromptData(promptName, parsedJson);
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
                        (window as any).aiStudioExt
                            .createMakerSuitePrompt(promptName, promptData)
                            .then((responseText: string) => {
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
                            })
                            .catch((status: number | string, statusText: string | null) => {
                                console.error("Failed to create prompt:", status, statusText);
                                alert("Failed to create prompt.\nError: " + status + " " + statusText);

                                // Close dialog after successful import
                                enableControls(); // Re-enable on error
                                closeDialog();
                            });
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
    const fileInput = overlayContainer.querySelector("#import-file-input") as HTMLInputElement;
    const fileDropArea = overlayContainer.querySelector(".import-file-drop-area") as HTMLElement;
    const fileInfo = overlayContainer.querySelector(".import-file-info") as HTMLElement;
    const jsonTextarea = overlayContainer.querySelector(".import-json-textarea") as HTMLTextAreaElement;
    const importButton = overlayContainer.querySelector(".import-button") as HTMLButtonElement;
    const errorDiv = overlayContainer.querySelector("#import-validation-error") as HTMLElement;

    // Reset file upload tab
    if (fileInput) fileInput.value = "";
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

/**
 * Fetches the incidents data from the AI Studio status API
 *
 * @returns {Promise<any>} The parsed incidents data
 */
async function fetchIncidentsData(): Promise<any> {
    try {
        return JSON.parse(await (window as any).aiStudioExt.sendMakerSuiteRequest("ListIncidentsHistory", "POST", []));
    } catch (error) {
        console.error("Failed to fetch incidents data:", error);
        return null;
    }
}

/**
 * Gets the latest update of an incident
 *
 * @param {any[]} statusUpdates - Array of status updates for the incident
 * @returns {any} The latest status update
 */
function getLatestUpdate(statusUpdates: any[]): any {
    // Sort by timestamp (descending)
    const sorted = [...statusUpdates].sort((a, b) => {
        const timeA = new Date(a[1]).getTime();
        const timeB = new Date(b[1]).getTime();
        return timeB - timeA;
    });

    return sorted[0];
}

/**
 * Determines if an incident is unresolved based on its status timestamps
 *
 * @param {any[]} statusUpdates - Array of status updates for the incident
 * @returns {boolean} True if the incident is unresolved, false otherwise
 */
function isIncidentUnresolved(statusUpdates: any[]): boolean {
    // Check if the latest status update is not RESOLVED
    const latestUpdate = getLatestUpdate(statusUpdates);
    return latestUpdate[0] !== INCIDENT_STATUS.RESOLVED;
}

/**
 * Stores data about active incidents
 */
interface ActiveIncidentData {
    platformId: number;
    platformName: string;
    incidentName: string;
    incidentDescription: string;
    severity: number;
    timestamp: string;
}

/**
 * Current active incidents, stored globally for the tooltip
 */
let activeIncidents: ActiveIncidentData[] = [];

/**
 * Determines the system status based on incidents data
 *
 * @param {any} incidentsData - The parsed incidents data from the API
 * @returns {string} The appropriate status icon name
 */
function determineSystemStatus(incidentsData: any): string {
    if (!incidentsData || !Array.isArray(incidentsData[0]) || !Array.isArray(incidentsData[0][0])) {
        // Return default icon if we can't parse the data
        return STATUS.OPERATIONAL;
    }

    // Reset active incidents
    activeIncidents = [];

    const incidents = incidentsData[0][0];
    let hasPartialOutage = false;
    let hasTotalOutage = false;

    for (let i = 0; i < incidents.length; i++) {
        const incident = incidents[i];
        const platformId = incident[4];
        const statusUpdates = incident[3].filter((update: any) => update[0] !== INCIDENT_STATUS.RESOLVED);
        incident[2] = Math.floor(Math.random() * 2) + 1;

        // Check if the incident is still unresolved, regardless of platform
        // Get the latest update to display in tooltip
        const latestUpdate = getLatestUpdate(statusUpdates);
        if (latestUpdate[0] !== INCIDENT_STATUS.RESOLVED) {
            // Add to active incidents list
            activeIncidents.push({
                platformId: platformId,
                platformName: PLATFORM_NAMES[platformId] || `Platform ${platformId}`,
                incidentName: incident[1],
                incidentDescription: INCIDENT_STATUS_NAMES[latestUpdate[0]] + ": " + latestUpdate[3],
                severity: incident[2],
                timestamp: latestUpdate[1],
            });

            // Check the outage severity
            if (incident[2] === OUTAGE_SEVERITY.PARTIAL) {
                hasPartialOutage = true;
            } else {
                // Anything other than PARTIAL is considered a total outage
                hasTotalOutage = true;
            }
        }
    }

    // Update the tooltip with active incidents data
    updateStatusTooltip();

    // Determine status based on outages
    if (hasTotalOutage) {
        return STATUS.TOTAL_OUTAGE;
    } else if (hasPartialOutage) {
        return STATUS.PARTIAL_OUTAGE;
    } else {
        return STATUS.OPERATIONAL;
    }
}

/**
 * Updates the status icon based on the current system status
 *
 * @param {string} iconName - The name of the icon to display
 */
function updateStatusIcon(iconName: string): void {
    const statusIcon = document.getElementById("ai-studio-status-icon");
    if (statusIcon) {
        statusIcon.textContent = iconName;

        // Update current status icon name for new injections
        currentStatusIconName = iconName;

        // Update icon color class
        statusIcon.classList.remove("operational", "partial", "total");
        if (iconName === STATUS.OPERATIONAL) {
            statusIcon.classList.add("operational");
        } else if (iconName === STATUS.PARTIAL_OUTAGE) {
            statusIcon.classList.add("partial");
        } else if (iconName === STATUS.TOTAL_OUTAGE) {
            statusIcon.classList.add("total");
        }
    }
}

/**
 * Checks the status of AI Studio and updates the status icon accordingly
 */
async function checkAndUpdateStatus(): Promise<void> {
    try {
        // Check if the status icon is visible
        const statusIconElement = document.getElementById("ai-studio-status-icon");
        if (!statusIconElement) return;

        // Set icon to pending while checking
        updateStatusIcon(STATUS.PENDING);

        const incidentsData = await fetchIncidentsData();

        if (incidentsData === null) {
            // API call failed
            updateStatusIcon(STATUS.ERROR);
            console.error("Failed to fetch incidents data: API response was null");
            return;
        }

        const statusIcon = determineSystemStatus(incidentsData);
        updateStatusIcon(statusIcon);
        console.debug("AI Studio status updated:", statusIcon);
    } catch (error) {
        // Set icon to error on failure
        updateStatusIcon(STATUS.ERROR);
        console.error("Failed to update status:", error);
    }
}

// Initialize when the document is fully loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    initialize();
}
