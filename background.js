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
  } else if (msg.type === 'captureScreenshot') {
    try {
      console.log('[ClipMD] Capturing screenshot for rect:', msg.rect);
      
      // Capture visible tab
      const dataUrl = await browser.tabs.captureVisibleTab(null, { format: 'png' });
      
      // Crop to element bounds using canvas in background page
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const dpr = msg.devicePixelRatio || 1;
        
        canvas.width = msg.rect.width * dpr;
        canvas.height = msg.rect.height * dpr;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 
          msg.rect.x * dpr, msg.rect.y * dpr, 
          msg.rect.width * dpr, msg.rect.height * dpr,
          0, 0, canvas.width, canvas.height
        );
        
        // Copy to clipboard directly in background page (has DOM access)
        try {
          canvas.toBlob(async (blob) => {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              console.log('[ClipMD] Image copied to clipboard from background');
              // Notify content script of success
              await browser.tabs.sendMessage(sender.tab.id, {
                type: 'showToast',
                message: 'Screenshot copied!',
                success: true
              });
            } catch (clipErr) {
              console.error('[ClipMD] Clipboard write failed:', clipErr);
              // Fallback: open in new tab
              const croppedDataUrl = canvas.toDataURL('image/png');
              await browser.tabs.create({ url: croppedDataUrl });
              await browser.tabs.sendMessage(sender.tab.id, {
                type: 'showToast',
                message: 'Opened in new tab (clipboard blocked)',
                success: false
              });
            }
          }, 'image/png');
        } catch (err) {
          console.error('[ClipMD] toBlob failed:', err);
        }
      };
      img.src = dataUrl;
    } catch (err) {
      console.error('[ClipMD] Screenshot failed:', err);
    }
  }
});

// Inject content script and start picker
async function run(mode, tab) {
  let target = tab;
  
  if (!target?.id) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    target = tabs[0];
  }
  
  if (!target?.id) {
    console.error('[ClipMD] No active tab found');
    return;
  }
  
  console.log('[ClipMD] Starting picker in mode:', mode, 'for tab:', target.id);
  
  try {
    // Inject the picker script
    await browser.scripting.executeScript({
      target: { tabId: target.id },
      files: ['picker.js']
    });
    
    // Tell it to start
    await browser.tabs.sendMessage(target.id, { type: 'startPicker', mode });
  } catch (err) {
    console.error('[ClipMD] Failed to inject picker:', err);
  }
}

// Handle toolbar button click
browser.action.onClicked.addListener(tab => run('markdown', tab));

// Handle keyboard shortcuts
browser.commands.onCommand.addListener((command, tab) => {
  console.log('[ClipMD] Command received:', command);
  if (command === '_execute_action') {
    run('markdown', tab);
  } else if (command === 'clipmd-screenshot') {
    run('screenshot', tab);
  }
});

console.log('[ClipMD] Background script loaded');
