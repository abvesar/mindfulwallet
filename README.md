# MindfulWallet

MindfulWallet is a Chrome extension designed to help users pause and reflect before falling into risky online decisions such as gambling, scam-style prompts, or high-pressure checkout tactics.

## Features

- Blocks risky gambling or scam-like URLs with a warning page
- Detects manipulative website patterns such as urgency and fake scarcity
- Shows a lockout countdown after a bypass attempt
- Provides a popup dashboard with basic intervention statistics

## Project Structure

- `manifest.json` – extension manifest
- `background.js` – service worker for URL interception and telemetry hooks
- `popup.html` / `popup.js` – extension popup UI
- `scanner.js` – content script that scans pages for high-pressure phrases
- `warning.html` / `warning.js` – safety warning experience
- `rules.json` – declarative net request rules

## How to Load the Extension Locally

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the folder that directly contains `manifest.json` and the other extension files
5. Do not select a parent folder or a subfolder that does not contain the manifest

## Beta Testing Notes

- Test blocked-site redirects
- Test the scanner banner on pages containing urgency phrases
- Verify the countdown and popup stats update correctly
- Report any false positives or confusing UI behavior

## License

This project is for educational and beta-testing purposes.
