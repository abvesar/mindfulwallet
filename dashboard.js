const logContainer = document.getElementById('log-container');
const emptyMsg = document.getElementById('emptyMsg');
const totalCount = document.getElementById('totalCount');
const trapCount = document.getElementById('trapCount');
const scamCount = document.getElementById('scamCount');

let total = 0, traps = 0, scams = 0;

// Listen for scanning event messages sent out by background.js or scanner.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "logScanEvent") {
    if (emptyMsg) emptyMsg.remove();
    
    total++;
    if (message.status === "Scam Blocked") scams++;
    if (message.status === "Deceptive Trap") traps++;

    // Update Counters
    totalCount.innerText = total;
    trapCount.innerText = traps;
    scamCount.innerText = scams;

    // Create a new log row element
    const row = document.createElement('div');
    row.className = 'log-entry';

    let badgeClass = 'badge-safe';
    if (message.status.includes('Scam') || message.status.includes('Newborn')) badgeClass = 'badge-scam';
    if (message.status.includes('Trap') || message.status.includes('Deceptive')) badgeClass = 'badge-trap';

    row.innerHTML = `
      <span style="max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🌐 [${new Date().toLocaleTimeString()}] <b>${message.domain}</b></span>
      <span class="badge ${badgeClass}">${message.status}</span>
    `;

    // Prepend to show the latest activity at the top
    logContainer.insertBefore(row, logContainer.firstChild);
  }
});
