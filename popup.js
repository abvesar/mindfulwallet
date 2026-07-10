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
  const toggleTelemetry = document.getElementById('toggleTelemetry');

  function updatePopupStats() {
    chrome.storage.local.get(['gamblingCount', 'scamCount', 'lockExpiration'], (data) => {
      const gambling = data.gamblingCount || 0;
      const scams = data.scamCount || 0;
      const isLocked = data.lockExpiration && Date.now() < data.lockExpiration ? 1 : 0;
      const moneySaved = (gambling * 500) + (scams * 1000);

      statGambling.innerText = gambling;
      statScams.innerText = scams;
      statLocks.innerText = isLocked;
      statSavings.innerText = `₹${moneySaved.toLocaleString()}`;
    });
  }

  function renderActivityLog() {
    chrome.storage.local.get(['activityLog'], (data) => {
      const activities = Array.isArray(data.activityLog) ? data.activityLog : [];
      if (!activities.length) {
        activityList.innerHTML = '<li class="activity-item">No activity yet. Try visiting the demo shop or a risky page.</li>';
        return;
      }

      activityList.innerHTML = activities.slice(0, 5).map((item) => {
        const time = new Date(item.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `<li class="activity-item"><strong>${item.title}</strong><br>${item.detail}<br><span class="small">${time}</span></li>`;
      }).join('');
    });
  }

  function loadSettings() {
    chrome.storage.local.get(['settings', 'onboardingCompleted'], (data) => {
      const settings = data.settings || {};
      toggleBlock.checked = settings.blockSites !== false;
      toggleScanner.checked = settings.scannerAlerts !== false;
      toggleTelemetry.checked = settings.telemetryEnabled !== false;
      onboardingCard.style.display = data.onboardingCompleted ? 'none' : 'block';
    });
  }

  function saveSettings() {
    chrome.storage.local.set({
      settings: {
        blockSites: toggleBlock.checked,
        scannerAlerts: toggleScanner.checked,
        telemetryEnabled: toggleTelemetry.checked
      }
    });
  }

  toggleBlock.addEventListener('change', saveSettings);
  toggleScanner.addEventListener('change', saveSettings);
  toggleTelemetry.addEventListener('change', saveSettings);

  dismissOnboarding.addEventListener('click', () => {
    chrome.storage.local.set({ onboardingCompleted: true });
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
