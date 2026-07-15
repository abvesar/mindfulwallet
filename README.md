# MindfulWallet

MindfulWallet is a Chrome extension designed to help users pause and reflect before falling into risky online decisions such as gambling, scam-style prompts, or high-pressure checkout tactics.

## Features

- Blocks risky gambling or scam-like URLs with a warning page
- Detects manipulative website patterns such as urgency and fake scarcity
- Shows a lockout countdown after a bypass attempt
- Provides a branded popup with intervention statistics and safety controls
- Includes a live monitoring dashboard for demo and inspection flows
- Ships with custom extension icons and a reusable logo asset

## Project Structure

- `manifest.json` – extension manifest
- `background.js` – service worker for URL interception and telemetry hooks
- `popup.html` / `popup.js` – extension popup UI
- `scanner.js` – content script that scans pages for high-pressure phrases
- `warning.html` / `warning.js` – safety warning experience
- `dashboard.html` / `dashboard.js` – live monitoring console for demo activity
- `rules.json` – declarative net request rules
- `mindfulwallet-logo.svg` – reusable logo asset
- `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` – extension icons
- `test.shop.html` – local demo page with urgency and scarcity patterns

## Demo Flow

1. Load the extension in Chrome.
2. Open the popup to review settings and stats.
3. Visit `test.shop.html` in the browser to trigger scanner warnings.
4. Visit a blocked or scam-like URL to show the warning page.
5. Open `dashboard.html` as an extension page to monitor live events during the demo.

## How to Load the Extension Locally

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the folder that directly contains `manifest.json` and the other extension files
5. Do not select a parent folder or a subfolder that does not contain the manifest
6. Click the reload button in Chrome Extensions after any asset or manifest change

## Beta Testing Notes

- Test blocked-site redirects
- Test the scanner banner on pages containing urgency phrases
- Verify the countdown and popup stats update correctly
- Confirm the branded icon appears in the Chrome toolbar and extension list
- Report any false positives or confusing UI behavior

## License

This project is for educational and beta-testing purposes.
