# ClipMD: Chrome → Firefox Conversion Notes

## Overview

This document summarizes the conversion of [ClipMD](https://github.com/AnswerDotAI/clipmd) from a Chrome extension to Firefox. The Firefox version maintains feature parity while adapting to Firefox's extension architecture.

## Feature Comparison

| Feature | Chrome | Firefox |
|---------|--------|---------|
| **Manifest Version** | MV3 | MV3 |
| **Element Picker** | Chrome DevTools Protocol (CDP) | Custom content script with mouseover events |
| **Background** | Service Worker | Event Page (background.html) |
| **DOM Access** | Offscreen document | Direct in background page |
| **Clipboard (text)** | Content script via CDP | execCommand fallback |
| **Clipboard (image)** | CDP + offscreen | Background page canvas.toBlob() |
| **Screenshot** | CDP Page.captureScreenshot | browser.tabs.captureVisibleTab() |
| **Keyboard Shortcuts** | Ctrl+Shift+M, Ctrl+Shift+S | Alt+Shift+M, Alt+Shift+X |

## Key Architectural Differences

### 1. Element Picker

**Chrome**: Uses the `debugger` permission and Chrome DevTools Protocol to show the native element inspector overlay:
```javascript
chrome.debugger.attach({tabId}, "1.3");
chrome.debugger.sendCommand({tabId}, "Overlay.setInspectMode", {...});
```

**Firefox**: No debugger API available. Implemented custom picker using DOM events:
```javascript
document.addEventListener('mouseover', (e) => {
  e.target.style.outline = '3px solid rgba(111, 168, 220, 0.9)';
});
document.addEventListener('click', (e) => {
  const html = e.target.outerHTML;
  // Process element...
});
```

### 2. Background Context

**Chrome MV3**: Service workers have no DOM access, requiring an offscreen document for Turndown:
```json
"permissions": ["offscreen"]
```
```javascript
chrome.offscreen.createDocument({url: 'offscreen.html', ...});
```

**Firefox MV3**: Event pages retain DOM access:
```json
"background": { "page": "background.html" }
```
Turndown runs directly in the background page.

### 3. Screenshot Capture

**Chrome**: Full element capture via CDP, regardless of viewport:
```javascript
chrome.debugger.sendCommand({tabId}, "Page.captureScreenshot", {
  clip: {x, y, width, height, scale: 1}
});
```

**Firefox**: Limited to visible viewport:
```javascript
const dataUrl = await browser.tabs.captureVisibleTab(null, {format: 'png'});
// Then crop using canvas
```

### 4. Clipboard Access

**Chrome**: Works via offscreen document with full Clipboard API access.

**Firefox**: Strict user gesture requirements. Solutions:
- **Text**: Use `document.execCommand('copy')` fallback
- **Images**: Write from background page using `canvas.toBlob()` + `navigator.clipboard.write()`

## Firefox-Specific Challenges & Solutions

### Reserved Keyboard Shortcuts
- `Ctrl+Shift+M` → Firefox Responsive Design Mode
- `Ctrl+Shift+S` → Firefox Screenshot Tool

**Solution**: Use `Alt+Shift+*` pattern instead.

### Content Security Policy (CSP)
Sites like GitHub block `fetch("data:...")` calls.

**Solution**: Convert base64 to blob directly:
```javascript
const binary = atob(base64Data);
const bytes = new Uint8Array(binary.length);
for (let i = 0; i < binary.length; i++) {
  bytes[i] = binary.charCodeAt(i);
}
const blob = new Blob([bytes], { type: 'image/png' });
```

### Relative URL Resolution
Original clipmd doesn't resolve relative URLs (`/wiki/...` stays relative).

**Firefox version improvement**: Resolves all URLs before conversion:
```javascript
clone.querySelectorAll('a[href], img[src]').forEach(el => {
  if (el.href) el.setAttribute('href', el.href); // Forces absolute
  if (el.src) el.setAttribute('src', el.src);
});
```

### Wikipedia Cleanup (Firefox Enhancement)
Added filters for cleaner Wikipedia markdown:
- Removes `[edit]` links
- Removes `[citation needed]` markers
- Strips inline styles and classes
- Removes navigation boxes

## File Structure Comparison

```
Chrome (clipmd/)              Firefox (clipmd-firefox/)
├── manifest.json             ├── manifest.json
├── background.js             ├── background.js
├── offscreen.html            ├── background.html (replaces offscreen)
├── offscreen.js              │   (Turndown runs in background.js)
├── turndown.js               ├── turndown.js
└── icons/                    ├── picker.js (NEW - element selection)
                              └── icons/
```

## Permissions Comparison

| Permission | Chrome | Firefox | Notes |
|------------|--------|---------|-------|
| `debugger` | ✅ | ❌ | Not available in Firefox |
| `offscreen` | ✅ | ❌ | Not needed (event pages have DOM) |
| `activeTab` | ✅ | ✅ | Same |
| `clipboardWrite` | ✅ | ✅ | Same |
| `scripting` | ✅ | ✅ | Same |

## Usage

**Firefox Installation**:
1. Open `about:debugging`
2. Click "This Firefox" → "Load Temporary Add-on"
3. Select `manifest.json`

**Keyboard Shortcuts**:
- `Alt+Shift+M` - Copy element as Markdown
- `Alt+Shift+X` - Copy element as Screenshot

## Known Limitations (Firefox)

1. **Screenshot size**: Limited to viewport; elements larger than screen get cropped
2. **No native picker overlay**: Custom CSS highlight instead of DevTools-style overlay
3. **Clipboard timing**: Image clipboard may fail on some sites; falls back to opening in new tab

## Improvements Over Chrome Version

1. ✅ Resolves relative URLs to absolute
2. ✅ Wikipedia-specific cleanup (removes edit links, citations, etc.)
3. ✅ Visual indicator when picker is active
4. ✅ Smaller file size (no offscreen document needed)

## References

- [Firefox MV3 Migration Guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)
- [Firefox Event Pages](https://blog.mozilla.org/addons/2022/05/18/manifest-v3-in-firefox-recap-next-steps/)
- [copy-selection-as-markdown](https://github.com/0x6b/copy-selection-as-markdown) - Reference Firefox extension
