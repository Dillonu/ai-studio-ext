/**
 * Background script for the AI Studio Extension
 * Runs in the background and manages the extension's behavior
 */

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        console.log("AI Studio Extension installed");
    } else if (details.reason === "update") {
        console.log("AI Studio Extension updated");
    }
});

// Listen for tab updates to detect when the user is on AI Studio
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url?.includes("aistudio.google.com")) {
        console.log("User is on AI Studio");

        // You can send a message to the content script here if needed
        chrome.tabs.sendMessage(tabId, { action: "tabUpdated" }).catch((error) => {
            // Suppress errors if content script isn't ready yet
            console.log("Content script not ready yet");
        });
    }
});

// Add action listener for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
    if (tab.url?.includes("aistudio.google.com")) {
        // Send message to content script to toggle import dialog
        chrome.tabs.sendMessage(tab.id!, { action: "toggleImportDialog" }).catch((error) => {
            console.log("Content script not ready yet or error occurred", error);
        });
    }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "backgroundAction") {
        // Handle any background actions here
        sendResponse({ success: true });
    }

    // Required for async response
    return true;
});
