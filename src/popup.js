document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggle');
  const resetButton = document.getElementById('reset');
  const statsDiv = document.getElementById('stats');
  const needle = document.getElementById('needle');
  const meterLabel = document.getElementById('meter-label');
  const gaugeLabel = document.getElementById('gauge-label');

  // Track all sentiments in memory to avoid duplicates
  const allSentiments = new Map();

  // Toggle functionality
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

  // Reset functionality
  resetButton.addEventListener('click', () => {
    allSentiments.clear();
    chrome.runtime.sendMessage({ type: 'RESET_SENTIMENTS' });
    updateSentimentDisplay();
  });

  // Initial update and listen for real-time updates
  updateSentimentDisplay();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // console.log('Popup received message:', message);
    if (message.type === 'SENTIMENT_UPDATED') {
      message.sentiments.forEach(([text, sentiment]) => {
        if (!allSentiments.has(text)) {
          allSentiments.set(text, sentiment);
        }
      });
      updateSentimentDisplay();
      sendResponse({ received: true });
    } else if (message.type === 'SENTIMENTS_RESET') {
      allSentiments.clear();
      updateSentimentDisplay();
      sendResponse({ received: true });
    }
  });

  // Request initial sentiment data when popup opens
  chrome.runtime.sendMessage({ type: 'REQUEST_SENTIMENT' }, response => {
    // console.log('Popup got initial response:', response);
    if (response && response.sentiments) {
      response.sentiments.forEach(([text, sentiment]) => {
        if (!allSentiments.has(text)) {
          allSentiments.set(text, sentiment);
        }
      });
      updateSentimentDisplay();
    }
  });

  function updateSentimentDisplay() {
    let positive = 0, negative = 0, neutral = 0;
    let totalScore = 0;

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
    // console.log('Sentiment counts:', { positive, negative, neutral, totalScore, count });

    statsDiv.innerHTML = `
      Positive: ${positive}<br>
      Negative: ${negative}<br>
      Neutral: ${neutral}
    `;

    const averageScore = count > 0 ? totalScore / count : 0;
    // console.log('Calculated averageScore:', averageScore); // Debug the score

    let meterValue;
    if (averageScore > 0) {
      meterValue = 50 + (averageScore * 50); // 0 to 1 -> 50 to 100
    } else {
      meterValue = 50 * (1 + averageScore); // -1 to 0 -> 0 to 50
    }
    const rotation = (meterValue / 100) * 180 - 90;
    needle.style.transform = `rotate(${rotation}deg)`;

    // Update dynamic label based on averageScore
    let sentimentLabel = '';
    let labelColor = '';
    if (averageScore > 0) { // Positive
      sentimentLabel = 'POSITIVE';
      labelColor = '#28a745'; // Green
    } else if (averageScore < 0) { // Negative
      sentimentLabel = 'NEGATIVE';
      labelColor = '#dc3545'; // Red
    } else { // Neutral
      sentimentLabel = 'NEUTRAL';
      labelColor = '#6c757d'; // Gray
    }
    console.log('Setting gauge label to:', sentimentLabel, 'with color:', labelColor); // Debug label
    gaugeLabel.textContent = sentimentLabel;
    gaugeLabel.style.color = labelColor;

    meterLabel.textContent = `Overall Sentiment: ${averageScore.toFixed(2)} (${count} posts)`;
  }
});