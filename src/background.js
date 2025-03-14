let sentiments = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_SENTIMENT') {
    // console.log('Background received sentiments:', message.sentiments);
    message.sentiments.forEach(({ text, sentiment }) => {
      if (!sentiments.has(text)) {
        sentiments.set(text, sentiment);
      }
    });
    chrome.runtime.sendMessage({ type: 'SENTIMENT_UPDATED', sentiments: Array.from(sentiments.entries()) });
    sendResponse({ received: true });
  } else if (message.type === 'REQUEST_SENTIMENT') {
    // console.log('Background sending current sentiments:', Array.from(sentiments.entries()));
    sendResponse({ sentiments: Array.from(sentiments.entries()) });
  } else if (message.type === 'RESET_SENTIMENTS') {
    // console.log('Background resetting sentiments');
    sentiments.clear();
    chrome.runtime.sendMessage({ type: 'SENTIMENTS_RESET' });
    sendResponse({ received: true });
  }
});