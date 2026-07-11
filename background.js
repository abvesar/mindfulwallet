// Telemetry is enabled again, but it only sends when a real Discord webhook URL is available.
const DEFAULT_DISCORD_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1525030773223067698/bxu4FPVUbFOiA1r4CVhVMxKslWSICl1GyaGJOTeu3fWvmxfMdd3LR9_yNNB4zmfflC9M";
const defaultSettings = {
  blockSites: true,
  scannerAlerts: true,
  telemetryEnabled: true
};

function sendLiveTelemetry(eventTitle, eventDetails) {
  chrome.storage.local.get(["discordWebhookUrl", "settings"], (result) => {
    const settings = result.settings || {};
    const webhookUrl = (result.discordWebhookUrl || DEFAULT_DISCORD_WEBHOOK_URL).trim();

    if (settings.telemetryEnabled === false || !webhookUrl || webhookUrl.includes("your-webhook")) {
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

// Gracefully attempts to send scan/block events to an open dashboard monitoring page
function broadcastLog(domainName, statusVerdict) {
  try {
    chrome.runtime.sendMessage({
      action: "logScanEvent",
      domain: domainName,
      status: statusVerdict
    });
  } catch (err) {
    // Suppress error if no receiver is active
  }
}

function ensureDefaults() {
  chrome.storage.local.get(["settings", "activityLog", "gamblingCount", "scamCount", "lockExpiration", "onboardingCompleted"], (data) => {
    chrome.storage.local.set({
      settings: { ...defaultSettings, ...(data.settings || {}) },
      activityLog: Array.isArray(data.activityLog) ? data.activityLog : [],
      gamblingCount: typeof data.gamblingCount === "number" ? data.gamblingCount : 0,
      scamCount: typeof data.scamCount === "number" ? data.scamCount : 0,
      onboardingCompleted: data.onboardingCompleted === true,
      lockExpiration: data.lockExpiration || null
    });
  });
}

function recordActivity(title, detail, category) {
  chrome.storage.local.get(["activityLog", "gamblingCount", "scamCount"], (data) => {
    const activityLog = Array.isArray(data.activityLog) ? data.activityLog : [];
    const nextActivity = { title, detail, category, time: Date.now() };
    const updatedLog = [nextActivity, ...activityLog].slice(0, 8);
    const updates = { activityLog: updatedLog };

    if (category === "gambling") {
      updates.gamblingCount = (data.gamblingCount || 0) + 1;
    }

    if (category === "scam") {
      updates.scamCount = (data.scamCount || 0) + 1;
    }

    chrome.storage.local.set(updates);
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  ensureDefaults();
  sendLiveTelemetry("New Installation!", `A tester successfully installed MindfulWallet (Reason: ${details.reason}).`);
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaults();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "scanner-alert") {
    recordActivity("Scanner flagged a page", message.patterns.join(", "), "scam");
    try {
      broadcastLog(sender && sender.tab && sender.tab.url ? sender.tab.url : 'unknown', "Scam Blocked");
    } catch (e) {}
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

const blockList = [
  "randomgamblingsite.com",
  "sketchyscamsite.net",
  "bet365",
  "betfair",
  "bovada",
  "draftkings",
  "fanduel",
  "casino",
  "poker",
  "roulette",
  "blackjack",
  "slots",
  "sportsbet",
  "gambling",
  "betting",
  "scam",
  "fraud",
  "free-money",
  "crypto-investment",
  "fake-prize"
];

const officialAuthDomains = {
  google: ["://google.com"],
  microsoft: ["://microsoftonline.com", "://live.com"],
  meta: ["://facebook.com", "://meta.com"],
  apple: ["://apple.com"]
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  const url = changeInfo.url.toLowerCase();
  const isWarningPage = url.includes(chrome.runtime.getURL("warning.html"));

  chrome.storage.local.get(["settings"], (data) => {
    const settings = { ...defaultSettings, ...(data.settings || {}) };

    if (!settings.blockSites && !isWarningPage) {
      return;
    }

    const isBlocked = blockList.some((keyword) => url.includes(keyword));
    if (isBlocked && !isWarningPage) {
      recordActivity("Blocked risky site", `${tab.url || url}`, "gambling");
      try { broadcastLog(url, "Scam Blocked"); } catch(e) {}
      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL("warning.html")
      });
    }

    else {
      try { broadcastLog(url, "Active Scanner Safe"); } catch(e) {}
    }

    if ((url.includes("login") || url.includes("signin") || url.includes("verify") || url.includes("auth")) && !isWarningPage) {
      if (url.includes("google") && !officialAuthDomains.google.some((domain) => url.includes(domain))) {
        triggerFakeVerificationAlert(tabId, "Google Authentication");
      } else if ((url.includes("microsoft") || url.includes("live")) && !officialAuthDomains.microsoft.some((domain) => url.includes(domain))) {
        triggerFakeVerificationAlert(tabId, "Microsoft Security");
      }
    }
  });
});

function triggerFakeVerificationAlert(tabId, brandName) {
  console.warn(`🚨 WARNING: Fake ${brandName} window intercepted!`);
  recordActivity("Phishing attempt blocked", `${brandName} redirect triggered`, "scam");
  try { broadcastLog(brandName, "Scam Blocked"); } catch(e) {}
  sendLiveTelemetry("Gambling/Scam URL Blocked", "User tried to visit a restricted domain.");
  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL("warning.html?reason=fake_auth&brand=" + encodeURIComponent(brandName))
  });
}
