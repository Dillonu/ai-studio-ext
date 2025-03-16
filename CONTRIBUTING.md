# Contributing to AI Studio Extension

Thank you for your interest in contributing to the AI Studio Extension! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We strive to foster an inclusive and welcoming community.

## Technology Stack

This project uses:

-   TypeScript for type safety
-   Angular as the framework
-   Angular Material for UI components
-   Chrome Extension Manifest V3

## Development Setup

### Prerequisites

-   Node.js (v18+)
-   npm (v9+)
-   Angular CLI (`npm install -g @angular/cli`)

### Getting Started

1. Fork the repository
2. Clone your fork:
    ```
    git clone https://github.com/YOUR_USERNAME/ai-studio-ext.git
    cd ai-studio-ext
    ```
3. Install dependencies:
    ```
    npm install
    ```
4. Build the extension:
    ```
    npm run build:no-popup
    ```

## Building and Testing

### Building the Extension

To build the extension, run the following command:

```
npm run build:no-popup
```

This will create a `dist` directory with the built extension.

To build the extension with the popup, run the following command:

```
npm run build:full
```

This will create a `dist` directory with the built extension.

### Testing in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked" and select the `dist` directory
4. The extension should now be loaded and visible in your toolbar

## Coding Standards

### General Standards

-   Use TypeScript for all code
-   Use 4 spaces for indentation
-   Use JSDoc format for comments and documentation
-   Use for loops over forEach, map, etc.
-   Always preserve existing comments

### Angular Standards

-   Follow the Angular style guide
-   Create reusable components when appropriate
-   Use Angular services for shared functionality
-   Use Angular Material components for UI

### Chrome Extension Standards

-   Follow Manifest V3 guidelines
-   Keep content scripts minimal and focused

## Pull Request Process

1. Create a new branch for your feature or bugfix
2. Make your changes
3. Test your changes thoroughly
4. Ensure your code follows our coding standards
5. Submit a pull request with a clear description of the changes
6. Reference any related issues in your PR description

## Feature Requests and Bug Reports

Use GitHub Issues to submit feature requests and bug reports. Please include as much detail as possible:

-   For bugs: steps to reproduce, expected behavior, actual behavior, screenshots
-   For features: clear description of the feature, why it's valuable, any implementation ideas

## Running Tests

NOTE: There are no tests for this project yet.

```
npm test
```

## Documentation

All new features should include appropriate documentation. Update the README.md file if necessary.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [Apache 2.0 License](LICENSE).

## Questions?

If you have any questions about contributing, please open an issue with your question.
