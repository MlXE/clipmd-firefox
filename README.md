# ClipMD for Firefox 🦊

A Firefox port of [ClipMD](https://github.com/AnswerDotAI/clipmd) by [Jeremy Howard](https://github.com/jph00).

Quickly grab content from any webpage as **Markdown** - perfect for LLM context!

> **Note:** Screenshot functionality is not included - Firefox has excellent built-in screenshot tools (`Ctrl+Shift+S` or right-click → "Take Screenshot").

## Installation

1. Download the [latest release](../../releases) (or clone this repo)
2. Open Firefox → `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on..."
4. Select `manifest.json`

## Usage

| Action | Shortcut | Description |
|--------|----------|-------------|
| 📝 Copy Markdown | `Ctrl+Shift+Q` | Click element → copies as Markdown |
| ❌ Cancel | `Escape` | Exit picker mode |

You can also click the toolbar icon to activate the picker.

## Features

- **Element picker** with visual highlighting
- **URL resolution** - relative links become absolute
- **Empty link handling** - uses URL/title when link text is missing
- **Wikipedia cleanup** - removes `[edit]` links and `[citation needed]`
- **Works on strict CSP sites** like GitHub

## Differences from Chrome Version

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Element picker | DevTools Protocol (CDP) | Custom CSS + events |
| Shortcut | `Ctrl+Shift+M` | `Ctrl+Shift+Q` |
| Screenshot | Via extension | Use Firefox built-in (`Ctrl+Shift+S`) |
| Background | Service worker + offscreen | Event page |

## Credits

- Original Chrome extension: [AnswerDotAI/clipmd](https://github.com/AnswerDotAI/clipmd)
- [Turndown](https://github.com/mixmark-io/turndown) for HTML→Markdown conversion

## License

MIT - Same as original clipmd
