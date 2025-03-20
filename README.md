# AI Studio Extended

A Chrome extension that enhances Google's AI Studio with additional functionality, making your AI development workflow more efficient. This extension works exclusively on [Google AI Studio](https://aistudio.google.com/) and seamlessly integrates with the existing AI Studio interface.

## Table of Contents

-   [Features](#features)
    -   [Import Prompt](#import-prompt)
    -   [Status Icon](#status-icon)
    -   [UI Improvements](#ui-improvements)
-   [Screenshots](#screenshots)
-   [Installation](#installation)
    -   [From Chrome Web Store](#from-chrome-web-store-coming-soon)
    -   [Manual Installation](#manual-installation-for-developers-or-advanced-users)
-   [Usage](#usage)
-   [Privacy & Security](#privacy--security)
-   [For Developers](#for-developers)
-   [Support](#support)
-   [License](#license)

## Features

This extension adds useful features to Google's AI Studio, including:

### Import Prompt

Adds a convenient "Import Prompt" button right below the "Create Prompt" button in the navigation menu

The Import Prompt feature supports the following formats:

-   [Gemini API](https://ai.google.dev/api/generate-content#method:-models.generatecontent) (models.generateContent Request format)
-   [AI Studio Prompt](https://aistudio.google.com/library) (prompts can be downloaded from your Google Drive)

### Status Icon

Adds a "Status" indicator in the navigation menu that shows the current operational status of AI Studio:

-   Green check icon: All systems operational
-   Yellow warning icon: Partial service disruption
-   Red alert icon: Service disruption

Hover over the Status icon to see detailed information about any ongoing incidents. The status automatically updates every 5 minutes.

### UI Improvements

-   Fixed click areas in the navbar for improved user experience

## Screenshots

Here's how the extension looks in action:

### Import Prompt Dialog

![Import Prompt - Blank](docs/screenshots/PopupBlank.png)

### File Selection

![Import Prompt - File Selection](docs/screenshots/PopupFile.png)

### File Opened

![Import Prompt - File Opened](docs/screenshots/PopupFileOpened.png)

### Validation Success

![Import Prompt - Valid](docs/screenshots/PopupValid.png)

### Error Handling

![Import Prompt - Error](docs/screenshots/PopupError.png)

### Status Icon - All Systems Operational

![Status - All Operational](docs/screenshots/StatusOkay.png)

### Status Icon - Service Disruption

![Status - Service Disruption](docs/screenshots/StatusBad.png)

## Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store page for AI Studio Extended (link will be provided once published)
2. Click "Add to Chrome"
3. Confirm the installation when prompted

### Manual Installation (For Developers or Advanced Users)

1. Download the latest release from the [Releases page](https://github.com/Dillonu/ai-studio-extended/releases)
2. Unzip the downloaded file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top-right corner
5. Click "Load unpacked" and select the unzipped directory
6. The extension should now be installed and active when you visit [AI Studio](https://aistudio.google.com/)

## Usage

1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Look for the new "Import Prompt" button in the navigation menu (just below "Create Prompt")
3. Use this button to import prompts from external sources

## Privacy & Security

-   This extension only runs on the AI Studio website (https://aistudio.google.com/)
-   No data is collected or transmitted to external servers
-   The extension requires minimal permissions to function

## For Developers

If you're interested in contributing to this project, please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for development setup instructions and guidelines.

## Support

If you encounter any issues or have suggestions for improvements:

1. Check the [Issues](https://github.com/Dillonu/ai-studio-extended/issues) page to see if your issue has already been reported
2. If not, create a new issue with a clear description and steps to reproduce

## License

This project is licensed under the [Apache 2.0 License](LICENSE).

---

_Note: This extension is not affiliated with, endorsed by, or sponsored by Google or AI Studio. It is an independent project created to enhance the AI Studio experience._
