# ClipMD for Firefox 🦊

A Firefox port of [ClipMD](https://github.com/AnswerDotAI/clipmd) by [Jeremy Howard](https://github.com/jph00).

Quickly grab content from any webpage as **Markdown** or **Screenshot** - perfect for LLM context!

## Installation

1. Download the [latest release](../../releases) (or clone this repo)
2. Open Firefox → `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on..."
4. Select `manifest.json`

## Usage

| Action | Shortcut | Description |
|--------|----------|-------------|
| 📝 Copy Markdown | `Alt+Shift+M` | Click element → copies as Markdown |
| 📸 Copy Screenshot | `Alt+Shift+X` | Click element → copies as image |
| ❌ Cancel | `Escape` | Exit picker mode |

You can also click the toolbar icon to activate the Markdown picker.

## Features

- **Element picker** with visual highlighting
- **URL resolution** - relative links become absolute
- **Wikipedia cleanup** - removes `[edit]` links and `[citation needed]`
- **Works on strict CSP sites** like GitHub

## Differences from Chrome Version

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Element picker | DevTools Protocol (CDP) | Custom CSS + events |
| Shortcuts | `Ctrl+Shift+M/S` | `Alt+Shift+M/X` |
| Screenshot | Full element via CDP | Viewport only |
| Background | Service worker + offscreen | Event page |
| URL resolution | ❌ | ✅ |
| Wikipedia cleanup | ❌ | ✅ |

## Credits

- Original Chrome extension: [AnswerDotAI/clipmd](https://github.com/AnswerDotAI/clipmd)
- [Turndown](https://github.com/mixmark-io/turndown) for HTML→Markdown conversion

## License

MIT - Same as original clipmd
