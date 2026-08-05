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

// Array of dark patterns / deceptive phrases used by scam sites
const deceptivePatterns = [
  { pattern: /\bonly\s+\d+\s+left\b/i, type: "Fake Scarcity" },
  { pattern: /\bselling fast\b/i, type: "Artificial Urgency" },
  { pattern: /\bin high demand\b/i, type: "Artificial Urgency" },
  { pattern: /\boffer expires in\b/i, type: "Countdown Trap" },
  { pattern: /\bpeople are looking at this\b/i, type: "Social Pressure" },
  { pattern: /\bsomeone just bought\b/i, type: "Social Pressure" },
  { pattern: /\badd to cart before it'?s gone\b/i, type: "Artificial Urgency" },
  { pattern: /\blimited time offer\b/i, type: "Artificial Urgency" },
  { pattern: /\bact now\b/i, type: "Artificial Urgency" },
  { pattern: /\bwhile supplies last\b/i, type: "Fake Scarcity" },
  { pattern: /\bdon't miss out\b/i, type: "Artificial Urgency" }
];

const highConfidenceTypes = new Set(["Fake Scarcity", "Countdown Trap", "Social Pressure"]);
const TRANSACTION_PATH_HINTS = /(pay|payment|checkout|transfer|upi|bank|wallet|card|billing|transaction|signin|login|authorize)/i;
const BANKING_HOST_HINTS = /(bank|wallet|pay|upi|finance|neobank|payments?)/i;
const SENSITIVE_INPUT_SELECTOR = 'input[type="password"], input[name*="card" i], input[name*="cvv" i], input[name*="otp" i], input[name*="upi" i], input[autocomplete="cc-number"], input[autocomplete="one-time-code"]';
const TRUSTED_PAYMENT_HOSTS = [
  'paypal.com',
  'stripe.com',
  'razorpay.com',
  'payu.in',
  'cashfree.com',
  'adyen.com'
];

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTransactionalPage() {
  const hasSensitiveForm = Boolean(document.querySelector(SENSITIVE_INPUT_SELECTOR));
  const hasTransactionKeywordInPath = TRANSACTION_PATH_HINTS.test(window.location.pathname || '');
  const hasTransactionKeywordInHost = BANKING_HOST_HINTS.test(window.location.hostname || '');
  return hasSensitiveForm || hasTransactionKeywordInPath || hasTransactionKeywordInHost;
}

function isIpAddressHost(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname || '');
}

function isTrustedProcessor(hostname) {
  const host = (hostname || '').toLowerCase();
  return TRUSTED_PAYMENT_HOSTS.some((trustedHost) => host === trustedHost || host.endsWith(`.${trustedHost}`));
}

function collectTransactionRisks() {
  const risks = [];

  if (window.location.protocol !== 'https:') {
    risks.push('Transaction page is not using HTTPS');
  }

  const hostname = (window.location.hostname || '').toLowerCase();
  if (hostname.includes('xn--')) {
    risks.push('Potential lookalike domain (punycode hostname)');
  }

  if (isIpAddressHost(hostname)) {
    risks.push('Sensitive page is loaded from raw IP address');
  }

  const activeMixedContent = document.querySelectorAll('script[src^="http://"], iframe[src^="http://"], link[rel="stylesheet"][href^="http://"]');
  if (activeMixedContent.length > 0) {
    risks.push('Page includes insecure active content over HTTP');
  }

  const forms = Array.from(document.querySelectorAll('form'));
  const sensitiveForms = forms.filter((form) => form.querySelector(SENSITIVE_INPUT_SELECTOR));

  sensitiveForms.forEach((form) => {
    const actionAttr = (form.getAttribute('action') || '').trim();
    if (!actionAttr) {
      return;
    }

    try {
      const actionUrl = new URL(actionAttr, window.location.href);
      if (actionUrl.protocol !== 'https:') {
        risks.push('Sensitive form submits to a non-HTTPS endpoint');
      }

      if (actionUrl.origin !== window.location.origin && !isTrustedProcessor(actionUrl.hostname)) {
        risks.push('Sensitive form posts to an unverified external domain');
      }
    } catch (error) {
      risks.push('Sensitive form action URL is malformed');
    }
  });

  return [...new Set(risks)];
}

function ensureTransactionModal() {
  if (document.getElementById('mindful-wallet-transaction-modal')) {
    return document.getElementById('mindful-wallet-transaction-modal');
  }

  const modal = document.createElement('div');
  modal.id = 'mindful-wallet-transaction-modal';
  modal.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:rgba(14, 23, 31, 0.72)',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'padding:20px',
    'z-index:2147483646'
  ].join(';');

  modal.innerHTML = `
    <div style="max-width:560px;width:100%;background:#ffffff;border:1px solid #d4e6dc;border-radius:16px;padding:18px;font-family:Segoe UI, Arial, sans-serif;box-shadow:0 20px 40px rgba(0,0,0,0.25);">
      <h2 style="margin:0 0 8px;color:#9b1c1c;font-size:20px;">MindfulWallet Transaction Warning</h2>
      <p style="margin:0;color:#374151;line-height:1.5;">This page is requesting sensitive payment/login information under risky security conditions.</p>
      <ul id="mindful-wallet-transaction-risks" style="margin:12px 0 0 18px;color:#334155;"></ul>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
        <button id="mindful-wallet-cancel-transaction" style="border:1px solid #d1d5db;background:#f9fafb;color:#111827;border-radius:8px;padding:8px 12px;cursor:pointer;">Go Back</button>
        <button id="mindful-wallet-continue-transaction" style="border:none;background:#b91c1c;color:white;border-radius:8px;padding:8px 12px;cursor:pointer;">I Understand, Proceed Once</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

function showTransactionModal(risks, form) {
  const modal = ensureTransactionModal();
  const riskList = document.getElementById('mindful-wallet-transaction-risks');
  const cancelBtn = document.getElementById('mindful-wallet-cancel-transaction');
  const continueBtn = document.getElementById('mindful-wallet-continue-transaction');

  if (!riskList || !cancelBtn || !continueBtn) {
    return;
  }

  riskList.innerHTML = risks.map((risk) => `<li style="margin-bottom:6px;">${risk}</li>`).join('');
  modal.style.display = 'flex';

  cancelBtn.onclick = () => {
    modal.style.display = 'none';
  };

  continueBtn.onclick = () => {
    form.dataset.mindfulWalletAllowSubmitOnce = 'true';
    modal.style.display = 'none';
    form.requestSubmit();
  };
}

function injectTransactionRiskBanner(risks) {
  if (document.getElementById('mindful-wallet-transaction-banner')) {
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'mindful-wallet-transaction-banner';
  banner.style.cssText = [
    'position:fixed',
    'right:14px',
    'bottom:14px',
    'max-width:380px',
    'background:#fff7ed',
    'color:#7c2d12',
    'border:1px solid #fdba74',
    'border-radius:12px',
    'padding:12px',
    'box-shadow:0 14px 26px rgba(0,0,0,0.18)',
    'font-family:Segoe UI, Arial, sans-serif',
    'font-size:13px',
    'line-height:1.4',
    'z-index:2147483645'
  ].join(';');

  banner.innerHTML = `<strong>Secure Transaction Shield:</strong> ${risks[0]}. Sensitive submissions on this page will be paused for review.`;
  document.body.appendChild(banner);
}

function injectSecureTransactionBadge() {
  if (document.getElementById('mindful-wallet-secure-badge')) {
    return;
  }

  const badge = document.createElement('div');
  badge.id = 'mindful-wallet-secure-badge';
  badge.style.cssText = [
    'position:fixed',
    'right:14px',
    'bottom:14px',
    'background:#ecfdf5',
    'color:#065f46',
    'border:1px solid #86efac',
    'border-radius:999px',
    'padding:8px 12px',
    'font-family:Segoe UI, Arial, sans-serif',
    'font-size:12px',
    'font-weight:600',
    'z-index:2147483644'
  ].join(';');
  badge.textContent = 'MindfulWallet: Secure transaction checks passed';
  document.body.appendChild(badge);
}

function guardSensitiveForms(risks) {
  const forms = Array.from(document.querySelectorAll('form')).filter((form) => form.querySelector(SENSITIVE_INPUT_SELECTOR));

  forms.forEach((form) => {
    if (form.dataset.mindfulWalletGuardAttached === 'true') {
      return;
    }

    form.dataset.mindfulWalletGuardAttached = 'true';
    form.addEventListener('submit', (event) => {
      if (form.dataset.mindfulWalletAllowSubmitOnce === 'true') {
        delete form.dataset.mindfulWalletAllowSubmitOnce;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      showTransactionModal(risks, form);
    });
  });
}

async function runTransactionShield() {
  if (!document.body || !isTransactionalPage()) {
    return;
  }

  const data = await storageGet(['settings']);
  const settings = data.settings || {};
  if (settings.secureTransactions === false) {
    return;
  }

  const risks = collectTransactionRisks();
  if (risks.length > 0) {
    injectTransactionRiskBanner(risks);
    guardSensitiveForms(risks);
    BROWSER.runtime.sendMessage({ type: 'transaction-risk', risks });
    return;
  }

  injectSecureTransactionBadge();
  if (!window.sessionStorage.getItem('mindfulWalletTransactionSafeLogged')) {
    window.sessionStorage.setItem('mindfulWalletTransactionSafeLogged', 'true');
    BROWSER.runtime.sendMessage({ type: 'transaction-safe' });
  }
}

async function runScanner() {
  if (!document.body) return;

  const data = await storageGet(["settings"]);
  const settings = data.settings || {};
  if (settings.scannerAlerts === false) return;

  const bodyText = normalizeText(document.body.innerText);
  const detectedPatterns = deceptivePatterns.filter((pattern) => pattern.pattern.test(bodyText));

  const shouldAlert =
    detectedPatterns.length >= 2 ||
    detectedPatterns.some((pattern) => highConfidenceTypes.has(pattern.type));

  if (shouldAlert) {
    const uniquePatterns = [...new Set(detectedPatterns.map((pattern) => pattern.type))];
    highlightTextOnPage(detectedPatterns);
    injectSafetyBanner(uniquePatterns);
    BROWSER.runtime.sendMessage({ type: "scanner-alert", patterns: uniquePatterns });
  }
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
    const match = detectedPatterns.find((pattern) => pattern.pattern.test(text));

    if (match) {
      parent.style.border = "2px dashed #ff007f";
      parent.style.backgroundColor = "#fff0f5";
      parent.title = `MindfulWallet: This phrase is flagged as a ${match.type} trap!`;
    }
  }
}

if (document.readyState === "loading") {
  window.addEventListener("load", () => {
    runScanner();
    runTransactionShield();
  }, { once: true });
} else {
  setTimeout(runScanner, 1500);
  setTimeout(runTransactionShield, 1800);
  function blindfoldSponsoredAds() {
    const posts = document.querySelectorAll('div, article, section');

    posts.forEach((post) => {
      const text = post.innerText.toLowerCase();
      if (text.includes('sponsored') && (text.includes('bet') || text.includes('casino') || text.includes('crypto win'))) {
        post.style.filter = 'blur(10px)';
        post.style.pointerEvents = 'none';
        console.log("🛡️ MindfulWallet blurred a predatory social media ad!");
      }
    });
  }

  setInterval(blindfoldSponsoredAds, 3000);

  const globalBrandsRegistry = [
    { name: "nike", officialDomain: "nike.com" },
    { name: "adidas", officialDomain: "adidas.com" },
    { name: "amazon", officialDomain: "amazon.com" },
    { name: "apple", officialDomain: "apple.com" }
  ];

  function differentiateAds() {
    const adsOnPage = document.querySelectorAll('div[data-testid="placement-tracking"], iframe, .sponsored-ad-card');

    adsOnPage.forEach((ad) => {
      const adText = ad.innerText.toLowerCase();
      const destinationLink = ad.querySelector('a')?.href.toLowerCase();

      if (destinationLink) {
        globalBrandsRegistry.forEach((brand) => {
          if (adText.includes(brand.name) && !destinationLink.includes(brand.officialDomain)) {
            ad.style.border = "4px solid #d32f2f";
            ad.style.backgroundColor = "#ffebee";
            ad.style.position = "relative";

            const alertTag = document.createElement('div');
            alertTag.innerText = `⚠️ MINDFULWALLET: Fake Ad Detected! Claims to be ${brand.name} but links to an unverified domain.`;
            alertTag.style.cssText = "position:absolute; top:0; background:#d32f2f; color:white; font-weight:bold; padding:5px; font-size:11px; z-index:99;";
            ad.prepend(alertTag);
          }
        });
      }
    });
  }

  setInterval(differentiateAds, 2500);
}
