const Sentiment = require('sentiment');
const sentiment = new Sentiment();

// Store processed post IDs to avoid duplicates
const processedPosts = new Set();

// Add CSS for flag styling
function addStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .sentiment-flag {
      font-size: 14px;
      display: inline-block;
      margin-right: 5px;
      line-height: 1;
      vertical-align: middle;
    }
    .flag-container {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
  `;
  document.head.appendChild(style);
}

// Inject styles once
addStyles();

function processPosts() {
  chrome.storage.local.get(['enabled'], result => {
    if (result.enabled === false) return;
    
    const posts = document.querySelectorAll('article[data-testid="tweet"]');
    const newSentiments = [];
    
    posts.forEach(post => {
      const textElement = post.querySelector('div[lang]');
      if (!textElement) return;
      const text = textElement.textContent.trim();
      const postId = `${text.slice(0, 50)}-${Math.random().toString(36).slice(2, 7)}`;

      if (processedPosts.has(postId)) return;
      processedPosts.add(postId);

      const targetDiv = post.querySelector('.css-175oi2r.r-1awozwy.r-18u37iz.r-1cmwbt1.r-1wtj0ep');
      if (!targetDiv) return;

      const existingFlag = targetDiv.querySelector('.sentiment-flag');
      if (existingFlag) existingFlag.remove();

      targetDiv.classList.add('flag-container');

      chrome.storage.local.get([text], result => {
        let sentimentLabel;
        if (result[text]) {
          sentimentLabel = result[text];
        } else {
          const analysis = sentiment.analyze(text);
          sentimentLabel = 
            analysis.score > 0 ? 'Positive' :
            analysis.score < 0 ? 'Negative' : 'Neutral';
          chrome.storage.local.set({ [text]: sentimentLabel });
        }
        displaySentiment(targetDiv, sentimentLabel);
        newSentiments.push({ text, sentiment: sentimentLabel });

        // Send to background script
        if (newSentiments.length > 0) {
          // console.log('Content script sending sentiments to background:', newSentiments);
          chrome.runtime.sendMessage({
            type: 'UPDATE_SENTIMENT',
            sentiments: newSentiments
          }, response => {
            if (chrome.runtime.lastError) {
              console.log('Error sending to background:', chrome.runtime.lastError);
            } else {
              console.log('Sent to background successfully:', response);
            }
          });
        }
      });
    });
  });
}

function displaySentiment(targetDiv, sentiment) {
  const sentimentFlag = document.createElement('span');
  sentimentFlag.className = `sentiment-flag ${sentiment.toLowerCase()}`;
  sentimentFlag.textContent = '■';
  const colorMap = {
    'positive': '#28a745',
    'negative': '#dc3545',
    'neutral': '#6c757d'
  };
  sentimentFlag.style.setProperty('color', colorMap[sentiment.toLowerCase()], 'important');
  targetDiv.insertBefore(sentimentFlag, targetDiv.firstChild);
}

// Throttle function to limit updates
function throttle(func, limit) {
  let inThrottle;
  return function() {
    if (!inThrottle) {
      func.apply(this, arguments);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

const throttledProcessPosts = throttle(processPosts, 750);

window.addEventListener('load', processPosts);
window.addEventListener('scroll', throttledProcessPosts);

const observer = new MutationObserver(throttledProcessPosts);
observer.observe(document.body, { childList: true, subtree: true });