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

const logContainer = document.getElementById('log-container');
const emptyMsg = document.getElementById('emptyMsg');
const totalCount = document.getElementById('totalCount');
const trapCount = document.getElementById('trapCount');
const scamCount = document.getElementById('scamCount');

let total = 0, traps = 0, scams = 0;

function getBadgeClass(status) {
  if (status.includes('Scam')) return 'badge-scam';
  if (status.includes('Trap') || status.includes('Deceptive')) return 'badge-trap';
  return 'badge-safe';
}

function renderLogRow(domain, status, timestamp) {
  if (emptyMsg) emptyMsg.remove();

  const row = document.createElement('div');
  row.className = 'log-entry';
  row.innerHTML = `
    <span style="max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🌐 [${new Date(timestamp).toLocaleTimeString()}] <b>${domain}</b></span>
    <span class="badge ${getBadgeClass(status)}">${status}</span>
  `;
  logContainer.insertBefore(row, logContainer.firstChild);
}

function updateCounters() {
  totalCount.innerText = total;
  trapCount.innerText = traps;
  scamCount.innerText = scams;
}

async function bootstrapDashboard() {
  const data = await storageGet(['activityLog']);
  const activities = Array.isArray(data.activityLog) ? data.activityLog.slice().reverse() : [];

  total = 0;
  traps = 0;
  scams = 0;
  logContainer.innerHTML = '';

  activities.forEach((item) => {
    total += 1;

    let status = 'Active Scanner Safe';
    if (item.category === 'scam' && item.title.includes('Scanner flagged')) {
      status = 'Deceptive Trap';
      traps += 1;
    } else if (item.category === 'scam') {
      status = 'Scam Blocked';
      scams += 1;
    } else if (item.category === 'gambling') {
      status = 'Risky Site Blocked';
    }

    renderLogRow(item.detail || item.title || 'unknown', status, item.time || Date.now());
  });

  if (!activities.length) {
    logContainer.innerHTML = '<div id="emptyMsg">Awaiting network traffic... Start browsing to view scan sequences.</div>';
  }

  updateCounters();
}

bootstrapDashboard();

BROWSER.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.activityLog) {
    bootstrapDashboard();
  }
});

// Listen for scanning event messages sent out by background.js or scanner.js
BROWSER.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "logScanEvent" && message.status === "Active Scanner Safe") {
    total++;
    updateCounters();
    renderLogRow(message.domain, message.status, Date.now());
  }
});
