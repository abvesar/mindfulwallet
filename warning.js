// Read the reason for the block from the URL parameters
const urlParams = new URLSearchParams(window.location.search);
const blockReason = urlParams.get('reason');
const brandName = urlParams.get('brand');

// If the block happened because of a fake verification window, swap the text dynamically
if (blockReason === 'fake_auth') {
  document.querySelector('h1').innerText = '⚠️ Phishing Scam Detected!';
  document.querySelector('p').innerText = `MindfulWallet intercepted a fake security prompt pretending to be ${brandName}. Entering your password or card details here will send them directly to hackers.`;

  document.querySelector('.prompt-title').innerText = '🛡️ Security Check:';
  document.querySelector('.prompt-text').innerText = 'Official portals never use strange web links. Double-check the URL bar before typing!';
  document.getElementById('bypassBtn').style.display = 'none';
}

const safeBtn = document.getElementById('safeBtn');
const bypassBtn = document.getElementById('bypassBtn');
const timerContainer = document.getElementById('timerContainer');
const countdownClock = document.getElementById('countdownClock');

let countdownInterval = null;

function startCountdown(expirationTime) {
  clearInterval(countdownInterval);

  bypassBtn.disabled = true;
  bypassBtn.style.opacity = '0.5';
  bypassBtn.innerText = 'Bypass Request Locked';
  timerContainer.style.display = 'block';

  updateClock(expirationTime);
  countdownInterval = window.setInterval(() => updateClock(expirationTime), 1000);
}

function updateClock(expirationTime) {
  const now = Date.now();
  const timeLeft = expirationTime - now;

  if (timeLeft <= 0) {
    clearInterval(countdownInterval);
    chrome.storage.local.remove('lockExpiration');
    bypassBtn.disabled = false;
    bypassBtn.style.opacity = '1';
    bypassBtn.innerText = 'Bypass (Start 24hr Lockout)';
    timerContainer.style.display = 'none';
    countdownClock.innerText = '24:00:00';
    return;
  }

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  const displayHours = hours.toString().padStart(2, '0');
  const displayMinutes = minutes.toString().padStart(2, '0');
  const displaySeconds = seconds.toString().padStart(2, '0');

  countdownClock.innerText = `${displayHours}:${displayMinutes}:${displaySeconds}`;
}

safeBtn.addEventListener('click', () => {
  window.location.href = 'https://google.com';
});

chrome.storage.local.get(['lockExpiration'], (result) => {
  if (result.lockExpiration) {
    const now = Date.now();
    if (now < result.lockExpiration) {
      startCountdown(result.lockExpiration);
    } else {
      chrome.storage.local.remove('lockExpiration');
    }
  }
});

bypassBtn.addEventListener('click', () => {
  const twentyFourHours = 24 * 60 * 60 * 1000;
  const expirationTime = Date.now() + twentyFourHours;

  chrome.storage.local.set({ lockExpiration: expirationTime }, () => {
    startCountdown(expirationTime);
  });
});
