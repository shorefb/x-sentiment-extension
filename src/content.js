const Sentiment = require('sentiment');
const sentiment = new Sentiment();

// Store processed post IDs to avoid duplicates
const processedPosts = new Set();
let allSentiments = []; // Accumulate all sentiments, reset on new batch

// Add CSS for background styling
function addStyles() {
  const style = document.createElement('style');
  style.textContent = `
    article[data-testid="tweet"].sentiment-negative {
      background-color: rgba(220, 53, 69, 0.2) !important; /* Red with 20% opacity */
    }
    article[data-testid="tweet"].sentiment-neutral {
      background-color: rgba(108, 117, 125, 0.2) !important; /* Gray with 20% opacity */
    }
    article[data-testid="tweet"].sentiment-positive {
      background-color: rgba(40, 167, 69, 0.2) !important; /* Green with 20% opacity */
    }
  `;
  document.head.appendChild(style);
}

// Inject styles once
addStyles();

function processPosts() {
  chrome.storage.local.get(['enabled'], result => {
    if (result.enabled === false) {
      console.log('Extension disabled, skipping processing');
      return;
    }

    const posts = document.querySelectorAll('article[data-testid="tweet"]');
    console.log('Found', posts.length, 'posts to process');

    const newSentiments = [];
    let processedNewPosts = false;

    posts.forEach(post => {
      const timeElement = post.querySelector('time');
      const tweetId = timeElement ? timeElement.getAttribute('datetime') : null;
      let textElement = post.querySelector('div[data-testid="tweetText"]');
      if (!textElement) {
        textElement = post.querySelector('div[lang]');
        if (!textElement) {
          textElement = post.querySelector('div[role="article"] span, div[role="article"] div');
        }
      }
      if (!textElement) {
        console.log('No text element found in post:', post.outerHTML.slice(0, 100)); // Log partial HTML for debugging
        return;
      }

      const text = textElement.textContent.trim();
      if (!text) {
        console.log('Empty text in post');
        return;
      }

      // Use a stable unique postId based on tweetId and text
      const postId = tweetId ? `${tweetId}-${text.slice(0, 50)}` : `${Date.now()}-${text.slice(0, 50)}-${Math.random().toString(36).slice(2, 7)}`;
      if (processedPosts.has(postId)) {
        console.log('Post already processed:', postId);
        return;
      }
      processedPosts.add(postId);
      processedNewPosts = true;
      console.log('Processing new post:', postId);

      const existingClass = post.className.match(/(sentiment-[a-z]+)/);
      if (existingClass) post.classList.remove(existingClass[0]);

      chrome.storage.local.get([text], result => {
        let sentimentLabel;
        if (result[text]) {
          sentimentLabel = result[text];
          console.log('Using cached sentiment for', text, ':', sentimentLabel);
        } else {
          const analysis = sentiment.analyze(text);
          console.log('Sentiment analysis for', text, ':', analysis);
          sentimentLabel = 
            analysis.score > 1 ? 'Positive' :
            analysis.score < -1 ? 'Negative' : 'Neutral';
          chrome.storage.local.set({ [text]: sentimentLabel });
          console.log('Assigned sentiment:', sentimentLabel);
        }
        post.classList.add(`sentiment-${sentimentLabel.toLowerCase()}`);
        newSentiments.push(sentimentLabel);
        allSentiments.push(sentimentLabel);

        // Only send if new posts were processed
        if (processedNewPosts && newSentiments.length > 0) {
          console.log('Sending UPDATE_SENTIMENT:', allSentiments);
          chrome.runtime.sendMessage({
            type: 'UPDATE_SENTIMENT',
            sentiments: allSentiments
          }, response => {
            if (chrome.runtime.lastError) {
              console.error('Error sending UPDATE_SENTIMENT:', chrome.runtime.lastError);
            } else {
              console.log('UPDATE_SENTIMENT sent successfully:', response);
            }
          });
        } else {
          console.log('No new posts or sentiments to send');
        }
      });
    });

    // Reset allSentiments if no new posts were processed
    if (!processedNewPosts && allSentiments.length > 0) {
      allSentiments = []; // Clear to prevent stale data
      console.log('Reset allSentiments due to no new posts');
    }
  });
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

const throttledProcessPosts = throttle(processPosts, 3000); // Increased to 3000ms

// Custom observer to only trigger on new tweet additions
const observer = new MutationObserver((mutations) => {
  let newTweetsDetected = false;
  mutations.forEach(mutation => {
    if (mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && node.querySelector('article[data-testid="tweet"]')) {
          newTweetsDetected = true;
        }
      });
    }
  });
  if (newTweetsDetected) {
    console.log('New tweets detected, triggering processPosts');
    throttledProcessPosts();
  } else {
    console.log('No new tweets detected, skipping processPosts');
  }
});

observer.observe(document.body, { childList: true, subtree: true });