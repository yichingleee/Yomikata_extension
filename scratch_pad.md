# Scratch Pad

## Implementation Log
- Created `extension/manifest.json` with MV3 config, permissions, host permissions, and Alt+Y command.
- Added `extension/background.js` for command handling, API fetch (Jisho/Tatoeba/LibreTranslate), and caching.
- Added popup UI assets: `extension/popup.html`, `extension/popup.css`, `extension/popup.js`.
- Added `extension/content.js` to render popup, handle selection, vocab list, and quiz UI.
- Added `extension/lib/furigana.js` stub with optional Kuroshiro/Kuromoji ESM loader.
- Added `extension/lib/README.txt` describing furigana module setup.
- Created empty `extension/assets/` directory for future icons.
- Tweaked popup rendering to reset reading on loading/error states.
- Silenced runtime.lastError for missing content scripts in background messaging.
- Updated suggested shortcut to Ctrl+Shift+Y in manifest.
- Added web-accessible resources for popup assets and furigana modules.
- Added content-script injection fallback and explicit no-selection responses.
- Added Kuroshiro/Kuromoji UMD builds plus ESM wrappers and dictionary files.
- Updated furigana loader to read KuromojiAnalyzer fallback name.
- Added partial-failure handling and console warnings for API fetch errors.
- Added LibreTranslate fallback endpoint and safer JSON parsing for HTML responses.
- Forced popup text colors to avoid host page CSS overriding definitions.
- Added MyMemory fallback translation and host permission for API key-free ZH definitions.
- Updated furigana loader to read UMD globals via globalThis after dynamic import.
- Added UMD fallback loaders for Kuroshiro/Kuromoji and extra global resolution checks.
- Patched bundled Kuroshiro runtime to avoid CSP-violating Function eval.
- Unwrapped default exports from UMD globals so Kuroshiro/Kuromoji constructors resolve correctly.
