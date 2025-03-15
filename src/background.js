// src/background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message);
  chrome.runtime.sendMessage(message);
  sendResponse({ relayed: true });
});