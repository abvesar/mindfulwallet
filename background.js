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

// Telemetry is opt-in and requires a user-provided webhook URL.
const DEFAULT_DISCORD_WEBHOOK_URL = "";
const defaultSettings = {
  blockSites: true,
  scannerAlerts: true,
  secureTransactions: true,
  telemetryEnabled: false
};

async function sendLiveTelemetry(eventTitle, eventDetails) {
  const result = await storageGet(["discordWebhookUrl", "settings"]);
  const settings = result.settings || {};
  const webhookUrl = (result.discordWebhookUrl || DEFAULT_DISCORD_WEBHOOK_URL).trim();

  if (settings.telemetryEnabled !== true || !webhookUrl || webhookUrl.includes("your-webhook")) {
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

const blockedDomains = [
  "randomgamblingsite.com",
  "sketchyscamsite.net",
  "bet365.com",
  "betfair.com",
  "bovada.lv",
  "draftkings.com",
  "fanduel.com"
];

const riskyHostKeywordPattern = /(casino|poker|roulette|blackjack|slots|sportsbet|gambling|betting|scam|fraud)/i;
const lureHostKeywordPattern = /(free-money|crypto-investment|fake-prize)/i;
const highRiskTlds = new Set(["bet", "win", "top", "click", "cam", "xyz"]);
const suspiciousHostTokens = new Set([
  "bet",
  "casino",
  "poker",
  "roulette",
  "blackjack",
  "slots",
  "sportsbet",
  "gambling",
  "crypto",
  "airdrop",
  "jackpot",
  "prize",
  "bonus",
  "doublemoney",
  "scam",
  "fraud"
]);

function normalizeHostname(hostname) {
  return (hostname || "").toLowerCase().replace(/^www\./, "");
}

function matchesBlockedDomain(hostname) {
  const normalizedHost = normalizeHostname(hostname);
  return blockedDomains.some((domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`));
}

function matchesSuspiciousHostPattern(hostname) {
  const normalizedHost = normalizeHostname(hostname);
  return riskyHostKeywordPattern.test(normalizedHost) && lureHostKeywordPattern.test(normalizedHost);
}

function assessHostnameRisk(hostname) {
  const normalizedHost = normalizeHostname(hostname);
  const tld = normalizedHost.split(".").pop() || "";
  const parts = normalizedHost.split(/[^a-z0-9]+/).filter(Boolean);
  const tokenHits = parts.reduce((count, token) => count + (suspiciousHostTokens.has(token) ? 1 : 0), 0);

  let score = 0;

  if (normalizedHost.includes("xn--")) {
    score += 3;
  }

  if (highRiskTlds.has(tld)) {
    score += 2;
  }

  if ((normalizedHost.match(/-/g) || []).length >= 3) {
    score += 1;
  }

  if (/\d{4,}/.test(normalizedHost)) {
    score += 1;
  }

  if (riskyHostKeywordPattern.test(normalizedHost)) {
    score += 1;
  }

  if (lureHostKeywordPattern.test(normalizedHost)) {
    score += 2;
  }

  if (tokenHits >= 2) {
    score += 3;
  } else if (tokenHits === 1) {
    score += 1;
  }

  return { score, tokenHits };
}

function shouldBlockUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname;
    if (matchesBlockedDomain(hostname) || matchesSuspiciousHostPattern(hostname)) {
      return true;
    }

    const risk = assessHostnameRisk(hostname);
    return risk.score >= 6 || (risk.score >= 4 && risk.tokenHits >= 2);
  } catch (error) {
    return false;
  }
}

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

  const isBlocked = shouldBlockUrl(changeInfo.url);
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
