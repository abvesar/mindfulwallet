// Telemetry is enabled again, but it only sends when a real Discord webhook URL is available.
const DEFAULT_DISCORD_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1525030773223067698/bxu4FPVUbFOiA1r4CVhVMxKslWSICl1GyaGJOTeu3fWvmxfMdd3LR9_yNNB4zmfflC9M";

function sendLiveTelemetry(eventTitle, eventDetails) {
  chrome.storage.local.get(["discordWebhookUrl"], (result) => {
    const webhookUrl = (result.discordWebhookUrl || DEFAULT_DISCORD_WEBHOOK_URL).trim();

    if (!webhookUrl || webhookUrl.includes("your-webhook")) {
      console.warn("MindfulWallet telemetry skipped: set a real Discord webhook URL in chrome.storage.local under discordWebhookUrl.");
      return;
    }

    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📊 **MindfulWallet Live Event:**\n🔹 **Action:** ${eventTitle}\n📝 **Details:** ${eventDetails}\n🕒 **Time:** ${new Date().toLocaleTimeString()}`
      })
    }).catch(err => console.log("Telemetry failed:", err));
  });
}

// Trigger this automatically when someone installs the extension
chrome.runtime.onInstalled.addListener((details) => {
  sendLiveTelemetry("New Installation!", `A tester successfully installed MindfulWallet (Reason: ${details.reason}).`);
});

// More realistic blocked-site patterns for gambling and scam-style URLs
const blockList = [
  'randomgamblingsite.com',
  'sketchyscamsite.net',
  'bet365',
  'betfair',
  'bovada',
  'draftkings',
  'fanduel',
  'casino',
  'poker',
  'roulette',
  'blackjack',
  'slots',
  'sportsbet',
  'gambling',
  'betting',
  'scam',
  'fraud',
  'free-money',
  'crypto-investment',
  'fake-prize'
];

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the URL has finished loading or is updating
  if (changeInfo.url) {
    const url = changeInfo.url.toLowerCase();
    
    // Check if the URL contains any blocked keywords
    const isBlocked = blockList.some(keyword => url.includes(keyword));
    
    // Ensure we don't accidentally intercept our own warning page loop
    const isWarningPage = url.includes(chrome.runtime.getURL('warning.html'));

    if (isBlocked && !isWarningPage) {
      // Redirect the specific tab to our custom warning screen
      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL('warning.html')
      });
    }
  }
});
// A database of real, official security verification domains
const officialAuthDomains = {
  'google': ['://google.com'],
  'microsoft': ['://microsoftonline.com', '://live.com'],
  'meta': ['://facebook.com', '://meta.com'],
  'apple': ['://apple.com']
};

// Monitor when a new window or tab opens up for verification
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const url = changeInfo.url.toLowerCase();

    // Check if the page is pretending to be a security/sign-in portal
    if (url.includes('login') || url.includes('signin') || url.includes('verify') || url.includes('auth')) {
      
      // Let's check if it claims to be Google but uses a fake domain
      if (url.includes('google') && !officialAuthDomains.google.some(domain => url.includes(domain))) {
        triggerFakeVerificationAlert(tabId, 'Google Authentication');
      }
      
      // Check if it claims to be Microsoft but uses a fake domain
      else if ((url.includes('microsoft') || url.includes('live')) && !officialAuthDomains.microsoft.some(domain => url.includes(domain))) {
        triggerFakeVerificationAlert(tabId, 'Microsoft Security');
      }
    }
  }
});

// Redirect the user to safety if a fake security window is caught
function triggerFakeVerificationAlert(tabId, brandName) {
  console.warn(`🚨 WARNING: Fake ${brandName} window intercepted!`);
  sendLiveTelemetry("Gambling/Scam URL Blocked", "User tried to visit a restricted domain.");
  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL('warning.html?reason=fake_auth&brand=' + encodeURIComponent(brandName))
  });
}
