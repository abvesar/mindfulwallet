// Optional remote logging. Leave blank in demo/local builds unless valid credentials are configured.
const BROWSER = globalThis.browser || globalThis.chrome;
const SUPABASE_URL = "";
const SUPABASE_KEY = "";
let remoteTelemetryDisabled = false;

function hasRemoteTelemetryConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function storageGet(keys) {
  const storageArea = BROWSER?.storage?.local;
  if (!storageArea) {
    return Promise.resolve({});
  }

  const result = storageArea.get(keys);
  if (result && typeof result.then === "function") {
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
  if (result && typeof result.then === "function") {
    return result;
  }

  return new Promise((resolve) => {
    storageArea.set(items, resolve);
  });
}

function storageRemove(keys) {
  const storageArea = BROWSER?.storage?.local;
  if (!storageArea) {
    return Promise.resolve();
  }

  const result = storageArea.remove(keys);
  if (result && typeof result.then === "function") {
    return result;
  }

  return new Promise((resolve) => {
    storageArea.remove(keys, resolve);
  });
}
function getExtensionUrl(path) {
  return BROWSER?.runtime?.getURL ? BROWSER.runtime.getURL(path) : path;
}

function sendRuntimeMessage(message) {
  try {
    const result = BROWSER?.runtime?.sendMessage?.(message);
    if (result && typeof result.then === "function") {
      return result;
    }
  } catch (error) {
    // ignore missing receivers
  }
  return Promise.resolve();
}

// Helper function to uniquely identify a tester anonymously without tracking personal data
async function getOrCreateTesterId() {
  const result = await storageGet(["testerId"]);
  if (result.testerId) {
    return result.testerId;
  }

  const newId = "Tester_" + Math.random().toString(36).substring(2, 9).toUpperCase();
  await storageSet({ testerId: newId });
  return newId;
}

// The master function that pushes extension telemetry to your cloud dashboard
async function sendRemoteTelemetry(domainName, statusVerdict) {
  try {
    if (remoteTelemetryDisabled || !hasRemoteTelemetryConfig()) {
      return;
    }

    const testerId = await getOrCreateTesterId();
    const endpoint = `${SUPABASE_URL}/rest/v1/extension_logs`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        domain: domainName,
        status: statusVerdict,
        tester_id: testerId,
        created_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("☁️ Telemetry synced to cloud remotely.");
  } catch (error) {
    if (error && /HTTP 401|HTTP 403/i.test(String(error.message || error))) {
      remoteTelemetryDisabled = true;
      console.warn("Remote cloud logging disabled due to invalid Supabase credentials.");
      return;
    }

    console.error("Cloud logging failed:", error);
  }
}

// Log a remote ping immediately when the extension is first loaded
BROWSER.runtime.onInstalled.addListener(() => {
  sendRemoteTelemetry("System Initialisation", "Extension Activated");
});

// Telemetry is enabled again, but it only sends when a real Discord webhook URL is available.
const DEFAULT_DISCORD_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1525030773223067698/bxu4FPVUbFOiA1r4CVhVMxKslWSICl1GyaGJOTeu3fWvmxfMdd3LR9_yNNB4zmfflC9M";
const defaultSettings = {
  blockSites: true,
  scannerAlerts: true,
  secureTransactions: true,
  telemetryEnabled: true
};

async function sendLiveTelemetry(eventTitle, eventDetails) {
  const result = await storageGet(["discordWebhookUrl", "settings"]);
  const settings = result.settings || {};
  const webhookUrl = (result.discordWebhookUrl || DEFAULT_DISCORD_WEBHOOK_URL).trim();

  if (settings.telemetryEnabled === false || !webhookUrl || webhookUrl.includes("your-webhook")) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📊 **MindfulWallet Live Event:**\n🔹 **Action:** ${eventTitle}\n📝 **Details:** ${eventDetails}\n🕒 **Time:** ${new Date().toLocaleTimeString()}`
      })
    });
  } catch (err) {
    console.log("Telemetry failed:", err);
  }
}

// Gracefully attempts to send scan/block events to an open dashboard monitoring page
function broadcastLog(domainName, statusVerdict) {
  try {
    sendRuntimeMessage({
      action: "logScanEvent",
      domain: domainName,
      status: statusVerdict
    });
  } catch (err) {
    // Suppress error if no receiver is active
  }
}

async function ensureDefaults() {
  const data = await storageGet(["settings", "activityLog", "gamblingCount", "scamCount", "lockExpiration", "onboardingCompleted"]);
  await storageSet({
    settings: { ...defaultSettings, ...(data.settings || {}) },
    activityLog: Array.isArray(data.activityLog) ? data.activityLog : [],
    gamblingCount: typeof data.gamblingCount === "number" ? data.gamblingCount : 0,
    scamCount: typeof data.scamCount === "number" ? data.scamCount : 0,
    onboardingCompleted: data.onboardingCompleted === true,
    lockExpiration: data.lockExpiration || null
  });
}

async function recordActivity(title, detail, category) {
  const data = await storageGet(["activityLog", "gamblingCount", "scamCount"]);
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

  await storageSet(updates);
}

BROWSER.runtime.onInstalled.addListener((details) => {
  ensureDefaults();
  sendLiveTelemetry("New Installation!", `A tester successfully installed MindfulWallet (Reason: ${details.reason}).`);
});

BROWSER.runtime.onStartup.addListener(() => {
  ensureDefaults();
});

BROWSER.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "scanner-alert") {
    recordActivity("Scanner flagged a page", message.patterns.join(", "), "scam");
    try {
      broadcastLog(sender && sender.tab && sender.tab.url ? sender.tab.url : "unknown", "Deceptive Trap");
    } catch (e) {}
    sendResponse({ ok: true });
    return true;
  }

  if (message && message.type === "transaction-risk") {
    const riskDetails = Array.isArray(message.risks) ? message.risks.join(", ") : "Unknown transaction risk";
    recordActivity("Transaction risk blocked", riskDetails, "scam");
    try {
      broadcastLog(sender && sender.tab && sender.tab.url ? sender.tab.url : "unknown", "Transaction Risk Blocked");
    } catch (e) {}
    sendResponse({ ok: true });
    return true;
  }

  if (message && message.type === "transaction-safe") {
    try {
      broadcastLog(sender && sender.tab && sender.tab.url ? sender.tab.url : "unknown", "Secure Transaction Verified");
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

BROWSER.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  const url = changeInfo.url.toLowerCase();
  const isWarningPage = url.includes(getExtensionUrl("warning.html"));
  const data = await storageGet(["settings"]);
  const settings = { ...defaultSettings, ...(data.settings || {}) };

  if (!settings.blockSites && !isWarningPage) {
    return;
  }

  const isBlocked = blockList.some((keyword) => url.includes(keyword));
  if (isBlocked && !isWarningPage) {
    recordActivity("Blocked risky site", `${tab.url || url}`, "gambling");
    try { broadcastLog(url, "Risky Site Blocked"); } catch (e) {}
    BROWSER.tabs.update(tabId, {
      url: getExtensionUrl("warning.html")
    });
  }

  else {
    try { broadcastLog(url, "Active Scanner Safe"); } catch (e) {}
  }

  if ((url.includes("login") || url.includes("signin") || url.includes("verify") || url.includes("auth")) && !isWarningPage) {
    if (url.includes("google") && !officialAuthDomains.google.some((domain) => url.includes(domain))) {
      triggerFakeVerificationAlert(tabId, "Google Authentication");
    } else if ((url.includes("microsoft") || url.includes("live")) && !officialAuthDomains.microsoft.some((domain) => url.includes(domain))) {
      triggerFakeVerificationAlert(tabId, "Microsoft Security");
    }
  }
});

function triggerFakeVerificationAlert(tabId, brandName) {
  console.warn(`🚨 WARNING: Fake ${brandName} window intercepted!`);
  recordActivity("Phishing attempt blocked", `${brandName} redirect triggered`, "scam");
  try { broadcastLog(brandName, "Scam Blocked"); } catch (e) {}
  sendLiveTelemetry("Gambling/Scam URL Blocked", "User tried to visit a restricted domain.");
  BROWSER.tabs.update(tabId, {
    url: getExtensionUrl("warning.html?reason=fake_auth&brand=" + encodeURIComponent(brandName))
  });
}
