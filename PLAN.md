# Implementation Plan (From Scratch)

## 1) Scaffold the Extension
- Create `extension/` folder with:
  - `manifest.json`
  - `background.js` (service worker)
  - `content.js`
  - `popup.html`, `popup.css`, `popup.js`
  - `assets/` for icons (placeholder for now).
- Add `extension/lib/` for bundled libraries (kuroshiro, kuromoji, dict).

## 2) Manifest and Permissions
- Use Manifest V3 format compatible with Chrome and Firefox.
- Add `commands` entry for `Alt+Y`.
- Add `permissions`: `activeTab`, `storage`, `scripting`.
- Add `host_permissions` for:
  - `https://jisho.org/*`
  - `https://tatoeba.org/*`
  - LibreTranslate endpoint.
- Register `content.js` and `background.js`.

## 3) Selection + Trigger Flow
- On `Alt+Y`, `background.js` asks the active tab for:
  - Selected text.
  - Bounding rect for positioning.
- `content.js` returns selection data and positions a floating popup container.
- If no selection, show a short inline message in the popup.

## 4) Popup UI and Behavior
- Render a dark-themed popup anchored below the selection.
- Close on click-away or `Esc`.
- Include controls for:
  - Audio playback for the selected word.
  - Save to vocab list.
  - Toggle quiz mode (optional mixed mode).

## 5) Data Fetching Pipeline
- Query Jisho API for reading + English definitions.
- Query Tatoeba for two simple, everyday sentences.
- Translate English definitions to Chinese via LibreTranslate.
- Convert sentences to full-sentence furigana using `kuroshiro` + `kuromoji`.
- Return a unified payload to the popup.

## 6) Caching Strategy
- Cache results in `storage.local` keyed by word.
- Store reading, English/Chinese definitions, sentences, furigana, and timestamp.

## 7) Audio Playback
- Use `speechSynthesis` with a `ja-JP` voice for the selected word only.

## 8) Vocabulary List + Quiz
- Save vocab entries in `storage.local`.
- Provide popup-only list with add/remove and quick search.
- Optional quiz mode with mixed questions (meaning + reading).
- Track simple correctness stats per session.

## 9) UI States and Error Handling
- Loading state and API error fallback.
- Graceful degradation if sentences or translations are unavailable.

## 10) Manual Testing Checklist
- `Alt+Y` shows popup under selection and closes on click-away/`Esc`.
- English + Chinese definitions display.
- Two example sentences with full-sentence furigana.
- Audio playback works for the word.
- Vocab list add/remove works; quiz toggles and runs.
- Cache hits reduce repeated API calls.
