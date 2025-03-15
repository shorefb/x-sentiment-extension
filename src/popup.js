document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggle');
  const resetButton = document.getElementById('reset');
  const statsDiv = document.getElementById('stats');
  const needle = document.getElementById('needle');
  const meterLabel = document.getElementById('meter-label');
  const gaugeLabel = document.getElementById('gauge-label');

  const allSentiments = new Map();
  let userId = 'user123'; // Replace with a dynamic user ID in production

  chrome.storage.local.get(['enabled'], result => {
    const enabled = result.enabled !== false;
    toggleButton.textContent = enabled ? 'Turn Off' : 'Turn On';
  });

  toggleButton.addEventListener('click', () => {
    chrome.storage.local.get(['enabled'], result => {
      const enabled = result.enabled !== false;
      const newState = !enabled;
      chrome.storage.local.set({ enabled: newState });
      toggleButton.textContent = newState ? 'Turn Off' : 'Turn On';
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        chrome.tabs.reload(tabs[0].id);
      });
    });
  });

  resetButton.addEventListener('click', () => {
    allSentiments.clear();
    chrome.runtime.sendMessage({ type: 'RESET_SENTIMENTS' });
    updateSentimentDisplay();
    saveUserData();
  });

  fetchUserData().then(() => {
    updateSentimentDisplay();
  }).catch(error => {
    console.error('Error during initial fetch:', error);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Popup received message:', message); // Temporary log
    if (message.type === 'UPDATE_SENTIMENT') {
      console.log('Received sentiments:', message.sentiments); // Temporary log
      allSentiments.clear(); // Clear to use the latest full list
      message.sentiments.forEach((sentiment, index) => {
        allSentiments.set(`post-${Date.now()}-${index}`, sentiment);
      });
      updateSentimentDisplay();
      saveUserData();
      sendResponse({ received: true });
    } else if (message.type === 'SENTIMENTS_RESET') {
      allSentiments.clear();
      updateSentimentDisplay();
      saveUserData();
      sendResponse({ received: true });
    }
  });

  chrome.runtime.sendMessage({ type: 'REQUEST_SENTIMENT' }, response => {
    console.log('Popup got REQUEST_SENTIMENT response:', response); // Temporary log
    if (response && response.sentiments) {
      response.sentiments.forEach((sentiment, index) => {
        if (!allSentiments.has(`post-${index}`)) {
          allSentiments.set(`post-${index}`, sentiment);
        }
      });
      updateSentimentDisplay();
    }
  });

  function updateSentimentDisplay() {
    let positive = 0, negative = 0, neutral = 0;
    let totalScore = 0;

    console.log('Current allSentiments in popup:', Array.from(allSentiments.entries())); // Temporary log
    allSentiments.forEach(sentiment => {
      if (sentiment === 'Positive') {
        positive++;
        totalScore += 1;
      } else if (sentiment === 'Negative') {
        negative++;
        totalScore -= 1;
      } else if (sentiment === 'Neutral') {
        neutral++;
      }
    });

    const count = positive + negative + neutral;
    console.log('Sentiment counts:', { positive, negative, neutral, count }); // Temporary log

    statsDiv.innerHTML = `
      <div>Positive: ${positive}</div>
      <div>Negative: ${negative}</div>
      <div>Neutral: ${neutral}</div>
    `;

    const averageScore = count > 0 ? totalScore / count : 0;

    let meterValue;
    if (averageScore > 0) {
      meterValue = 50 + (averageScore * 50);
    } else {
      meterValue = 50 * (1 + averageScore);
    }
    const rotation = (meterValue / 100) * 180 - 90;
    needle.style.transform = `rotate(${rotation}deg)`;

    let sentimentLabel = '';
    let labelColor = '';
    if (averageScore > 0) {
      sentimentLabel = 'POSITIVE';
      labelColor = '#28a745';
    } else if (averageScore < 0) {
      sentimentLabel = 'NEGATIVE';
      labelColor = '#dc3545';
    } else {
      sentimentLabel = 'NEUTRAL';
      labelColor = '#6c757d';
    }
    gaugeLabel.textContent = sentimentLabel;
    gaugeLabel.style.color = labelColor;

    meterLabel.textContent = `Overall Sentiment: ${averageScore.toFixed(2)} (${count} posts)`;
  }

  async function saveUserData() {
    const sentimentHistory = Array.from(allSentiments.entries()).map(([key, sentiment]) => ({
      sentiment,
      timestamp: new Date().toISOString()
    }));
    const userData = {
      userId,
      preferences: { theme: 'dark' },
      sentimentHistory: sentimentHistory.length > 0 ? sentimentHistory : []
    };

    try {
      const response = await fetch('http://localhost:3000/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save data');
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  async function fetchUserData() {
    try {
      const response = await fetch(`http://localhost:3000/api/user/${userId}`);
      const userData = await response.json();
      if (!response.ok) throw new Error(userData.error || 'Failed to fetch data');
      if (userData.sentimentHistory && userData.sentimentHistory.length > 0 && allSentiments.size === 0) {
        userData.sentimentHistory.forEach((entry, index) => {
          if (!allSentiments.has(`post-${index}`)) {
            allSentiments.set(`post-${index}`, entry.sentiment);
          }
        });
      }
      return Promise.resolve();
    } catch (error) {
      console.error('Error fetching user data:', error);
      return Promise.reject(error);
    }
  }
});