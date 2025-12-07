// ClipMD Firefox - Background Script
const td = new TurndownService({ codeBlockStyle: "fenced" });

// Configure turndown for better output
td.addRule('fencedCodeBlock', {
  filter: function (node, options) {
    return (
      options.codeBlockStyle === 'fenced' &&
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    );
  },
  replacement: function (content, node, options) {
    const className = node.firstChild.getAttribute('class') || '';
    const language = (className.match(/language-(\S+)/) || [null, ''])[1];
    const code = node.firstChild.textContent;
    return '\n```' + language + '\n' + code + '\n```\n';
  }
});

// Fix empty links - use URL as title, or skip if truly empty
td.addRule('emptyLinks', {
  filter: function(node) {
    return node.nodeName === 'A' && node.getAttribute('href');
  },
  replacement: function(content, node) {
    const href = node.getAttribute('href');
    const title = node.getAttribute('title');
    
    // Clean up content - remove just whitespace
    const cleanContent = content.trim();
    
    // If link has content, use standard link format
    if (cleanContent && cleanContent !== '![]') {
      // Handle image links specially - content is already ![...]
      if (cleanContent.startsWith('![')) {
        return cleanContent; // Image is sufficient, skip wrapping in link
      }
      return '[' + cleanContent + '](' + href + ')';
    }
    
    // Empty link - check for image inside
    const img = node.querySelector('img');
    if (img) {
      const alt = img.getAttribute('alt') || '';
      const src = img.getAttribute('src') || href;
      return '![' + alt + '](' + src + ')';
    }
    
    // Use title attribute if available
    if (title) {
      return '[' + title + '](' + href + ')';
    }
    
    // Last resort: use the URL itself as display text (truncated if long)
    // Skip javascript: and anchor-only links
    if (href.startsWith('javascript:') || href === '#') {
      return '';
    }
    
    // For actual URLs, show a shortened version
    try {
      const url = new URL(href, 'https://example.com');
      const displayText = url.pathname !== '/' 
        ? decodeURIComponent(url.pathname.split('/').pop() || url.hostname)
        : url.hostname;
      return '[' + (displayText || href) + '](' + href + ')';
    } catch {
      return '[link](' + href + ')';
    }
  }
});

// Remove empty image references
td.addRule('emptyImages', {
  filter: function(node) {
    return node.nodeName === 'IMG' && !node.getAttribute('src');
  },
  replacement: function() {
    return '';
  }
});

// Handle messages from content script
browser.runtime.onMessage.addListener(async (msg, sender) => {
  console.log('[ClipMD] Received message:', msg.type);
  
  if (msg.type === 'convertMarkdown') {
    try {
      const markdown = td.turndown(msg.html || '');
      console.log('[ClipMD] Converted markdown length:', markdown.length);
      
      // Send back to content script to use clipboard
      await browser.tabs.sendMessage(sender.tab.id, { 
        type: 'copyToClipboard', 
        text: markdown 
      });
    } catch (err) {
      console.error('[ClipMD] Markdown conversion failed:', err);
    }
  }
});

// Inject content script and start picker
async function run(tab) {
  let target = tab;
  
  if (!target?.id) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    target = tabs[0];
  }
  
  if (!target?.id) {
    console.error('[ClipMD] No active tab found');
    return;
  }
  
  console.log('[ClipMD] Starting picker for tab:', target.id);
  
  try {
    // Inject the picker script
    await browser.scripting.executeScript({
      target: { tabId: target.id, allFrames: true },
      files: ['picker.js']
    });
    
    // Tell it to start
    await browser.tabs.sendMessage(target.id, { type: 'startPicker' });
  } catch (err) {
    console.error('[ClipMD] Failed to inject picker:', err);
    
    // Show user-friendly notification for restricted pages
    const url = target.url || '';
    let reason = 'Unknown error';
    
    if (url.startsWith('about:') || url.startsWith('moz-extension:')) {
      reason = 'Cannot run on browser internal pages';
    } else if (url.includes('addons.mozilla.org')) {
      reason = 'Cannot run on Mozilla Add-ons site (Firefox restriction)';
    } else if (url.startsWith('file:')) {
      reason = 'Cannot run on local files (enable in extension settings)';
    } else if (!url || url === 'about:blank') {
      reason = 'No page loaded';
    } else {
      reason = 'This page restricts extensions';
    }
    
    // Use notifications API if available, otherwise log
    try {
      await browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'ClipMD',
        message: reason
      });
    } catch (notifErr) {
      console.warn('[ClipMD] Notification failed:', notifErr, 'Reason:', reason);
    }
  }
}

// Handle toolbar button click
browser.action.onClicked.addListener(tab => run(tab));

// Handle keyboard shortcuts  
browser.commands.onCommand.addListener((command, tab) => {
  console.log('[ClipMD] Command received:', command);
  if (command === '_execute_action') run(tab);
});

console.log('[ClipMD] Background script loaded');
