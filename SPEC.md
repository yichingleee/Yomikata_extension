# Yomikata Extension Specification

## Goal
Build a Chrome/Firefox extension that lets a user select a Japanese kanji word, press `Alt+Y`, and see a dark-themed popup under the selection showing hiragana, English + Chinese definitions, and two simple example sentences with full-sentence furigana. The popup closes on click-away. The user can save the word to a vocabulary list and review it with an optional mixed-mode quiz in the popup.

## Platforms
- Chrome and Firefox (Manifest V3 where possible).

## Trigger and Behavior
- Trigger: keyboard shortcut `Alt+Y`.
- On trigger, read the current selection in the active tab.
- Popup is anchored just below the highlighted word.
- Popup dismisses on click-away or `Esc`.

## Content Requirements
- Show hiragana reading for the selected word (no romaji).
- Show English + Chinese definitions.
- Show 2 example sentences that are simple and usable in everyday life.
- Furigana for the entire example sentence (not only the target word).
- Audio playback for the selected word only.

## Data Sources
- English definitions and reading: Jisho API.
- Chinese definitions: machine-translate English definitions via a translation API (e.g., LibreTranslate or MyMemory).
- Example sentences: Tatoeba API.
- Furigana conversion: `kuroshiro` + `kuromoji` (client-side).

## Vocabulary List and Quiz
- Add a selected word to a vocabulary list stored locally.
- Vocabulary list UI lives in the popup only.
- Quiz mode is optional and user-selectable.
- Quiz type: mixed (meaning + reading), optional per user.

## Caching and Storage
- Cache lookups locally; no size limit.
- Store vocab list and quiz settings in extension storage.

## Styling
- Dark theme for the popup.

## Privacy
- Selected text can be sent to external APIs for lookup/translation.
