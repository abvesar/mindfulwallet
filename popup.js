const BROWSER = globalThis.browser || globalThis.chrome;

function storageGet(keys) {
  const storageArea = BROWSER?.storage?.local;
  if (!storageArea) {
    return Promise.resolve({});
  }

  const result = storageArea.get(keys);
  if (result && typeof result.then === 'function') {
    return result;
  }

  return new Promise((resolve) => {
    storageArea.get(keys, resolve);
  });
}

function storageSet(items) {
  const storageArea = BROWSER?.storage?.local;
  if (!storageArea) {
    return Promise.resolve();
  }

  const result = storageArea.set(items);
  if (result && typeof result.then === 'function') {
    return result;
  }

  return new Promise((resolve) => {
    storageArea.set(items, resolve);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const statGambling = document.getElementById('statGambling');
  const statScams = document.getElementById('statScams');
  const statLocks = document.getElementById('statLocks');
  const statSavings = document.getElementById('statSavings');
  const activityList = document.getElementById('activityList');
  const onboardingCard = document.getElementById('onboardingCard');
  const dismissOnboarding = document.getElementById('dismissOnboarding');
  const toggleBlock = document.getElementById('toggleBlock');
  const toggleScanner = document.getElementById('toggleScanner');
  const toggleSecureTransactions = document.getElementById('toggleSecureTransactions');
  const toggleTelemetry = document.getElementById('toggleTelemetry');

  async function updatePopupStats() {
    const data = await storageGet(['gamblingCount', 'scamCount', 'lockExpiration']);
    const gambling = data.gamblingCount || 0;
    const scams = data.scamCount || 0;
    const isLocked = data.lockExpiration && Date.now() < data.lockExpiration ? 1 : 0;
    const moneySaved = (gambling * 500) + (scams * 1000);

    statGambling.innerText = gambling;
    statScams.innerText = scams;
    statLocks.innerText = isLocked;
    statSavings.innerText = `₹${moneySaved.toLocaleString()}`;
  }

  async function renderActivityLog() {
    const data = await storageGet(['activityLog']);
    const activities = Array.isArray(data.activityLog) ? data.activityLog : [];
    if (!activities.length) {
      activityList.innerHTML = '<li class="activity-item">No activity yet. Try visiting the demo shop or a risky page.</li>';
      return;
    }

    activityList.innerHTML = activities.slice(0, 5).map((item) => {
      const time = new Date(item.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<li class="activity-item"><strong>${item.title}</strong><br>${item.detail}<br><span class="small">${time}</span></li>`;
    }).join('');
  }

  async function loadSettings() {
    const data = await storageGet(['settings', 'onboardingCompleted']);
    const settings = data.settings || {};
    toggleBlock.checked = settings.blockSites !== false;
    toggleScanner.checked = settings.scannerAlerts !== false;
    toggleSecureTransactions.checked = settings.secureTransactions !== false;
    toggleTelemetry.checked = settings.telemetryEnabled !== false;
    onboardingCard.style.display = data.onboardingCompleted ? 'none' : 'block';
  }

  async function saveSettings() {
    await storageSet({
      settings: {
        blockSites: toggleBlock.checked,
        scannerAlerts: toggleScanner.checked,
        secureTransactions: toggleSecureTransactions.checked,
        telemetryEnabled: toggleTelemetry.checked
      }
    });
  }

  toggleBlock.addEventListener('change', saveSettings);
  toggleScanner.addEventListener('change', saveSettings);
  toggleSecureTransactions.addEventListener('change', saveSettings);
  toggleTelemetry.addEventListener('change', saveSettings);

  dismissOnboarding.addEventListener('click', async () => {
    await storageSet({ onboardingCompleted: true });
    onboardingCard.style.display = 'none';
  });

  updatePopupStats();
  renderActivityLog();
  loadSettings();
  setInterval(() => {
    updatePopupStats();
    renderActivityLog();
  }, 1000);
});
