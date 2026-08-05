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

// Weighted signals make simple wording changes less likely to bypass detection.
const deceptiveSignals = [
  { pattern: /\bonly\s+(?:\d+|one|two|three|few|handful)\s+(?:left|remaining)\b/i, type: "Fake Scarcity", weight: 3 },
  { pattern: /\b(?:selling\s+fast|going\s+fast|moving\s+fast|high\s+demand)\b/i, type: "Artificial Urgency", weight: 2 },
  { pattern: /\b(?:offer|deal|price)\s+(?:expires?|ends?)\s+(?:in|soon|today)\b/i, type: "Countdown Trap", weight: 3 },
  { pattern: /\b(?:people\s+are\s+viewing|\d+\s+people\s+viewing|someone\s+just\s+bought|recently\s+purchased)\b/i, type: "Social Pressure", weight: 3 },
  { pattern: /\b(?:limited\s+time|act\s+now|dont\s+miss\s+out|last\s+chance|before\s+its\s+gone)\b/i, type: "Artificial Urgency", weight: 2 },
  { pattern: /\b(?:guaranteed\s+profit|risk\s*free\s+returns?|double\s+your\s+money|instant\s+withdrawal)\b/i, type: "Investment Lure", weight: 4 },
  { pattern: /\b(?:claim\s+your\s+prize|congratulations\s+winner|exclusive\s+winner)\b/i, type: "Prize Scam", weight: 4 }
];

const highConfidenceTypes = new Set(["Countdown Trap", "Social Pressure", "Investment Lure", "Prize Scam"]);
const URGENCY_TERMS_PATTERN = /\b(?:act\s+now|limited\s+time|ending\s+soon|hurry|last\s+chance|few\s+left|dont\s+miss\s+out|expires?)\b/gi;
const DOM_SCAN_DEBOUNCE_MS = 1800;
const PERIODIC_SCAN_MS = 20000;
const MAX_SCAN_NODES = 180;
const AD_TEXT_RISK_PATTERN = /\b(?:bet|casino|crypto\s+win|jackpot|sportsbook)\b/i;

const globalBrandsRegistry = [
  { name: "nike", officialDomain: "nike.com" },
  { name: "adidas", officialDomain: "adidas.com" },
  { name: "amazon", officialDomain: "amazon.com" },
  { name: "apple", officialDomain: "apple.com" }
];

let adScanTimeout = null;
let adPeriodicInterval = null;
let adMutationObserver = null;

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function runScanner() {
  if (!document.body) return;

  const data = await storageGet(["settings"]);
  const settings = data.settings || {};
  if (settings.scannerAlerts === false) return;

  const bodyText = normalizeText(document.body.innerText);
  const evaluation = evaluateDeceptionRisk(bodyText);
  const detectedPatterns = evaluation.detectedSignals;

  const shouldAlert =
    evaluation.score >= 5 ||
    detectedPatterns.length >= 2 ||
    detectedPatterns.some((signal) => highConfidenceTypes.has(signal.type));

  if (shouldAlert) {
    const uniquePatterns = [...new Set(detectedPatterns.map((signal) => signal.type))];
    highlightTextOnPage(detectedPatterns);
    injectSafetyBanner(uniquePatterns);
    BROWSER.runtime.sendMessage({ type: "scanner-alert", patterns: uniquePatterns });
  }
}

function evaluateDeceptionRisk(bodyText) {
  let score = 0;
  const detectedSignals = [];

  deceptiveSignals.forEach((signal) => {
    if (signal.pattern.test(bodyText)) {
      score += signal.weight;
      detectedSignals.push(signal);
    }
  });

  const urgencyHits = (bodyText.match(URGENCY_TERMS_PATTERN) || []).length;
  if (urgencyHits >= 3) {
    score += 2;
    detectedSignals.push({
      pattern: /\b(?:limited\s+time|hurry|ending\s+soon|act\s+now|few\s+left)\b/i,
      type: "Artificial Urgency",
      weight: 2
    });
  }

  if (hasCountdownWidget()) {
    score += 3;
    detectedSignals.push({
      pattern: /\b(?:countdown|timer|offer\s+ends)\b/i,
      type: "Countdown Trap",
      weight: 3
    });
  }

  return {
    score,
    detectedSignals: dedupeSignalsByType(detectedSignals)
  };
}

function dedupeSignalsByType(signals) {
  const byType = new Map();
  signals.forEach((signal) => {
    const existing = byType.get(signal.type);
    if (!existing || signal.weight > existing.weight) {
      byType.set(signal.type, signal);
    }
  });
  return Array.from(byType.values());
}

function hasCountdownWidget() {
  const countdownSelectors = [
    '[id*="countdown" i]',
    '[class*="countdown" i]',
    '[id*="timer" i]',
    '[class*="timer" i]',
    '[data-testid*="countdown" i]'
  ];

  return countdownSelectors.some((selector) => {
    const nodes = document.querySelectorAll(selector);
    return Array.from(nodes).some((node) => /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(node.textContent || ""));
  });
}

function injectSafetyBanner(patternsFound) {
  if (document.getElementById("mindful-wallet-alert-banner")) return;

  const banner = document.createElement("div");
  banner.id = "mindful-wallet-alert-banner";
  banner.style.cssText = `
    background-color: #ffebee;
    color: #c62828;
    border-bottom: 3px solid #e53935;
    padding: 15px;
    text-align: center;
    font-family: Arial, sans-serif;
    font-size: 15px;
    font-weight: bold;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 999999;
    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
  `;

  banner.innerHTML = `
    <span>🛡️ <b>MindfulWallet AI:</b> Detected high-pressure tactics (${patternsFound.join(", ")}). Don't let them rush your wallet.</span>
    <button id="closeMindfulBanner" style="background:#e53935; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;">Dismiss</button>
  `;

  document.body.style.paddingTop = "58px";
  document.body.prepend(banner);

  document.getElementById("closeMindfulBanner").addEventListener("click", () => {
    banner.remove();
    document.body.style.paddingTop = "0px";
  });
}

function highlightTextOnPage(detectedPatterns) {
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;

  while ((node = walk.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest("#mindful-wallet-alert-banner, script, style, noscript")) continue;

    const style = window.getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden") continue;

    const text = normalizeText(node.nodeValue || "");
    const match = detectedPatterns.find((pattern) => pattern.pattern && pattern.pattern.test(text));

    if (match) {
      parent.style.border = "2px dashed #ff007f";
      parent.style.backgroundColor = "#fff0f5";
      parent.title = `MindfulWallet: This phrase is flagged as a ${match.type} trap!`;
    }
  }
}

function blindfoldSponsoredAds() {
  const candidates = document.querySelectorAll('article, [role="article"], .sponsored-ad-card, [data-testid*="post" i], [data-testid*="feed" i]');
  const max = Math.min(candidates.length, MAX_SCAN_NODES);

  for (let index = 0; index < max; index += 1) {
    const post = candidates[index];
    if (!post || post.dataset.mindfulWalletScanned === '1') {
      continue;
    }

    post.dataset.mindfulWalletScanned = '1';
    const text = normalizeText(post.innerText || '');
    if (text.includes('sponsored') && AD_TEXT_RISK_PATTERN.test(text)) {
      post.style.filter = 'blur(10px)';
      post.style.pointerEvents = 'none';
      console.log('MindfulWallet blurred a predatory social media ad.');
    }
  }
}

function differentiateAds() {
  const adsOnPage = document.querySelectorAll('div[data-testid="placement-tracking"], .sponsored-ad-card, [aria-label*="sponsored" i]');
  const max = Math.min(adsOnPage.length, MAX_SCAN_NODES);

  for (let index = 0; index < max; index += 1) {
    const ad = adsOnPage[index];
    if (!ad || ad.dataset.mindfulWalletVerifiedAd === '1') {
      continue;
    }

    ad.dataset.mindfulWalletVerifiedAd = '1';
    const adText = normalizeText(ad.innerText || '');
    const destinationLink = (ad.querySelector('a')?.href || '').toLowerCase();
    if (!destinationLink) {
      continue;
    }

    globalBrandsRegistry.forEach((brand) => {
      if (adText.includes(brand.name) && !destinationLink.includes(brand.officialDomain)) {
        ad.style.border = '4px solid #d32f2f';
        ad.style.backgroundColor = '#ffebee';
        ad.style.position = 'relative';

        const alertTag = document.createElement('div');
        alertTag.innerText = `⚠️ MINDFULWALLET: Fake Ad Detected! Claims to be ${brand.name} but links to an unverified domain.`;
        alertTag.style.cssText = 'position:absolute; top:0; background:#d32f2f; color:white; font-weight:bold; padding:5px; font-size:11px; z-index:99;';
        ad.prepend(alertTag);
      }
    });
  }
}

function isDocumentVisible() {
  return document.visibilityState === 'visible';
}

function runAdProtections() {
  if (!document.body || !isDocumentVisible()) {
    return;
  }

  blindfoldSponsoredAds();
  differentiateAds();
}

function scheduleAdProtections(delayMs = DOM_SCAN_DEBOUNCE_MS) {
  if (adScanTimeout) {
    window.clearTimeout(adScanTimeout);
  }

  adScanTimeout = window.setTimeout(() => {
    adScanTimeout = null;
    runAdProtections();
  }, delayMs);
}

function startAdPeriodicScan() {
  if (adPeriodicInterval) {
    window.clearInterval(adPeriodicInterval);
  }

  adPeriodicInterval = window.setInterval(() => {
    if (isDocumentVisible()) {
      scheduleAdProtections(0);
    }
  }, PERIODIC_SCAN_MS);
}

function stopAdPeriodicScan() {
  if (adPeriodicInterval) {
    window.clearInterval(adPeriodicInterval);
    adPeriodicInterval = null;
  }
}

function setupAdMutationObserver() {
  if (!document.body || adMutationObserver) {
    return;
  }

  adMutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        scheduleAdProtections();
        break;
      }
    }
  });

  adMutationObserver.observe(document.body, { childList: true, subtree: true });
}

function setupVisibilityControls() {
  document.addEventListener('visibilitychange', () => {
    if (isDocumentVisible()) {
      scheduleAdProtections(250);
      startAdPeriodicScan();
    } else {
      if (adScanTimeout) {
        window.clearTimeout(adScanTimeout);
        adScanTimeout = null;
      }
      stopAdPeriodicScan();
    }
  });
}

function startAdProtectionRuntime() {
  setupAdMutationObserver();
  setupVisibilityControls();
  if (isDocumentVisible()) {
    scheduleAdProtections(0);
    startAdPeriodicScan();
  }
}

if (document.readyState === "loading") {
  window.addEventListener("load", () => {
    runScanner();
    startAdProtectionRuntime();
  }, { once: true });
} else {
  setTimeout(runScanner, 1500);
  startAdProtectionRuntime();
}
