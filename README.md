# Yomikata Extension

Chrome/Firefox extension for quick Japanese word lookup with readings, definitions,
examples, and furigana.

## Troubleshooting
- After changing scripts or bundled libs, reload the extension in
  `chrome://extensions` and hard-reload the test page to ensure content scripts
  and cached modules reset.
- If the popup does not show, confirm you have an active text selection and the
  hotkey is set in `chrome://extensions/shortcuts`.
