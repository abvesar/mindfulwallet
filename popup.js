document.addEventListener('DOMContentLoaded', () => {
  const statGambling = document.getElementById('statGambling');
  const statScams = document.getElementById('statScams');
  const statLocks = document.getElementById('statLocks');
  const statSavings = document.getElementById('statSavings');

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

  updatePopupStats();
  setInterval(updatePopupStats, 1000);
});
