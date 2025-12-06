// ClipMD Firefox - Element Picker Content Script
(function() {
  // Prevent multiple injections
  if (window.__clipmd_picker_active) {
    console.log('[ClipMD Picker] Already active');
    return;
  }
  
  // Resolve relative URLs to absolute (improves markdown output)
  function resolveRelativeUrls(container, baseUrl) {
    const base = new URL(baseUrl);
    
    // Resolve links
    for (const a of container.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('javascript:')) {
        try {
          a.setAttribute('href', new URL(href, base).href);
        } catch (e) { /* ignore invalid URLs */ }
      }
    }
    
    // Resolve images
    for (const img of container.querySelectorAll('img[src]')) {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        try {
          img.setAttribute('src', new URL(src, base).href);
        } catch (e) { /* ignore invalid URLs */ }
      }
    }
    
    // Resolve srcset for responsive images
    for (const img of container.querySelectorAll('[srcset]')) {
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        const resolved = srcset.split(',').map(part => {
          const [url, descriptor] = part.trim().split(/\s+/);
          if (url && !url.startsWith('http') && !url.startsWith('data:')) {
            try {
              return new URL(url, base).href + (descriptor ? ' ' + descriptor : '');
            } catch (e) { return part; }
          }
          return part;
        }).join(', ');
        img.setAttribute('srcset', resolved);
      }
    }
  }
  
  let lastHighlighted = null;
  let mode = 'markdown'; // or 'screenshot'
  let isActive = false;
  let modalEl = null;
  let pendingClipboardData = null; // Store data for clipboard write on user gesture
  
  const HIGHLIGHT_STYLE = {
    outline: '3px solid rgba(111, 168, 220, 0.9)',
    outlineOffset: '-1px',
    backgroundColor: 'rgba(111, 168, 220, 0.25)'
  };
  
  // Modal to show picker is active
  function showModal() {
    modalEl = document.createElement('div');
    modalEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">🎯</span>
        <div>
          <div style="font-weight:600;">ClipMD Active</div>
          <div style="font-size:12px;opacity:0.8;">Click an element to ${mode === 'markdown' ? 'copy as Markdown' : 'capture screenshot'}</div>
          <div style="font-size:11px;opacity:0.6;margin-top:4px;">Press ESC to cancel</div>
        </div>
      </div>
    `;
    modalEl.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 10px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      pointer-events: none;
    `;
    document.body.appendChild(modalEl);
  }
  
  function hideModal() {
    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
  }
  
  function highlight(el) {
    if (el === lastHighlighted) return;
    if (lastHighlighted) unhighlight(lastHighlighted);
    
    // Store original styles
    el.dataset.clipmdOriginalOutline = el.style.outline;
    el.dataset.clipmdOriginalOutlineOffset = el.style.outlineOffset;
    el.dataset.clipmdOriginalBg = el.style.backgroundColor;
    
    // Apply highlight
    el.style.outline = HIGHLIGHT_STYLE.outline;
    el.style.outlineOffset = HIGHLIGHT_STYLE.outlineOffset;
    el.style.backgroundColor = HIGHLIGHT_STYLE.backgroundColor;
    
    lastHighlighted = el;
  }
  
  function unhighlight(el) {
    if (!el) return;
    el.style.outline = el.dataset.clipmdOriginalOutline || '';
    el.style.outlineOffset = el.dataset.clipmdOriginalOutlineOffset || '';
    el.style.backgroundColor = el.dataset.clipmdOriginalBg || '';
    delete el.dataset.clipmdOriginalOutline;
    delete el.dataset.clipmdOriginalOutlineOffset;
    delete el.dataset.clipmdOriginalBg;
  }
  
  function onMouseOver(e) {
    if (!isActive) return;
    e.stopPropagation();
    highlight(e.target);
  }
  
  function onMouseOut(e) {
    // Keep current element highlighted until mouse enters new element
  }
  
  async function onClick(e) {
    if (!isActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const el = lastHighlighted || e.target;
    console.log('[ClipMD Picker] Element selected:', el.tagName);
    
    // Remove highlight before capture
    unhighlight(el);
    cleanup();
    
    if (mode === 'markdown') {
      // Clone element and clean up before conversion
      const clone = el.cloneNode(true);
      const baseUrl = window.location.href;
      
      // Resolve relative URLs
      resolveRelativeUrls(clone, baseUrl);
      
      // Remove Wikipedia-specific cruft
      const removeSelectors = [
        '.mw-editsection',           // [edit] links
        '.mw-cite-backlink',         // ↑ jump back links  
        '.reference',                // [1] citation markers
        '.noprint',                  // Elements hidden in print
        '.mw-empty-elt',             // Empty elements
        '.navbox',                   // Navigation boxes
        '.sistersitebox',            // Sister project boxes
        '.mbox-small',               // Small message boxes
        '[role="navigation"]',       // Nav elements
        '.authority-control',        // Authority control section
        '.catlinks',                 // Category links
        'sup.reference',             // Superscript references
        'sup.noprint',               // [citation needed] etc
        '.Template-Fact',            // [citation needed]
      ];
      clone.querySelectorAll(removeSelectors.join(', ')).forEach(el => el.remove());
      
      // Remove any remaining links that are just "[edit]" text
      clone.querySelectorAll('a').forEach(a => {
        const text = a.textContent.trim().toLowerCase();
        if (text === 'edit' || text === '[edit]' || a.href?.includes('action=edit')) {
          a.remove();
        }
      });
      
      // Remove "[citation needed]", "[broken anchor]" style text spans
      clone.querySelectorAll('span, i').forEach(el => {
        const text = el.textContent.trim().toLowerCase();
        if (text.includes('citation needed') || 
            text.includes('broken anchor') ||
            text === 'hide' ||
            text === 'show') {
          el.remove();
        }
      });
      
      // Remove style tags and script tags
      clone.querySelectorAll('style, script').forEach(el => el.remove());
      
      // Strip inline styles (they're useless in markdown)
      clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
      
      // Strip class attributes (also useless in markdown)
      clone.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));
      
      const html = clone.outerHTML;
      console.log('[ClipMD Picker] Sending HTML for conversion, length:', html.length);
      browser.runtime.sendMessage({ type: 'convertMarkdown', html });
    } else {
      // Screenshot mode - scroll into view and capture via background
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      
      // Wait for scroll to settle
      await new Promise(r => setTimeout(r, 100));
      
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Calculate visible portion (clamp to viewport)
      const visibleRect = {
        x: Math.max(0, rect.x) * dpr,
        y: Math.max(0, rect.y) * dpr,
        width: Math.min(rect.width, window.innerWidth - Math.max(0, rect.x)) * dpr,
        height: Math.min(rect.height, window.innerHeight - Math.max(0, rect.y)) * dpr
      };
      
      console.log('[ClipMD Picker] Capturing screenshot, visibleRect:', visibleRect);
      
      // Request screenshot from background
      browser.runtime.sendMessage({ 
        type: 'captureScreenshot', 
        rect: visibleRect,
        fullHeight: rect.height * dpr,
        fullWidth: rect.width * dpr
      });
    }
  }
  
  function onKeyDown(e) {
    if (!isActive) return;
    
    if (e.key === 'Escape') {
      console.log('[ClipMD Picker] Cancelled with Escape');
      if (lastHighlighted) unhighlight(lastHighlighted);
      cleanup();
    }
  }
  
  function cleanup() {
    isActive = false;
    window.__clipmd_picker_active = false;
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';
    lastHighlighted = null;
    hideModal();
    console.log('[ClipMD Picker] Cleaned up');
  }
  
  function startPicker(pickerMode) {
    mode = pickerMode;
    isActive = true;
    window.__clipmd_picker_active = true;
    
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = 'crosshair';
    
    showModal();
    console.log('[ClipMD Picker] Started in mode:', mode);
  }
  
  // Clipboard operations - uses execCommand fallback for Firefox compatibility
  function copyTextToClipboard(text) {
    // Use execCommand for reliable copy (works without user gesture)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showNotification('Markdown copied!');
      console.log('[ClipMD Picker] Text copied to clipboard');
    } catch (err) {
      console.error('[ClipMD Picker] Clipboard write failed:', err);
      showNotification('Copy failed - try again');
    }
    document.body.removeChild(ta);
  }
  
  async function copyImageToClipboard(base64Data) {
    try {
      // Convert base64 to blob without fetch() to avoid CSP issues
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      // Try clipboard API first
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showNotification('Screenshot copied!');
        console.log('[ClipMD Picker] Image copied to clipboard');
      } else {
        // Fallback: open image in new tab
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        showNotification('Screenshot opened in new tab');
      }
    } catch (err) {
      console.error('[ClipMD Picker] Image clipboard write failed:', err);
      // Fallback: open blob URL
      try {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        showNotification('Screenshot opened in new tab (clipboard blocked)');
      } catch (e) {
        showNotification('Screenshot failed');
      }
    }
  }
  
  function showNotification(message) {
    const notif = document.createElement('div');
    notif.textContent = message;
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: clipmd-fadeout 2s ease-in-out forwards;
    `;
    
    // Add animation keyframes if not present
    if (!document.getElementById('clipmd-styles')) {
      const style = document.createElement('style');
      style.id = 'clipmd-styles';
      style.textContent = `
        @keyframes clipmd-fadeout {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 2000);
  }
  
  // Listen for messages from background
  browser.runtime.onMessage.addListener((msg) => {
    console.log('[ClipMD Picker] Received message:', msg.type);
    
    if (msg.type === 'startPicker') {
      startPicker(msg.mode);
    } else if (msg.type === 'copyToClipboard') {
      copyTextToClipboard(msg.text);
    } else if (msg.type === 'showToast') {
      showNotification(msg.message);
    }
  });
  
  console.log('[ClipMD Picker] Content script loaded');
})();
