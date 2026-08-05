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

function safeSendRuntimeMessage(payload) {
  try {
    if (!BROWSER?.runtime?.sendMessage) {
      return;
    }

    const maybePromise = BROWSER.runtime.sendMessage(payload);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {});
    }
  } catch (error) {
    // Ignore messaging failures outside extension contexts.
  }
}

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

function guardSensitiveForms() {
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

      const liveRisks = collectTransactionRisks();
      if (liveRisks.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      showTransactionModal(liveRisks, form);
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
    guardSensitiveForms();
    safeSendRuntimeMessage({ type: 'transaction-risk', risks });
    return;
  }

  injectSecureTransactionBadge();
  if (!window.sessionStorage.getItem('mindfulWalletTransactionSafeLogged')) {
    window.sessionStorage.setItem('mindfulWalletTransactionSafeLogged', 'true');
    safeSendRuntimeMessage({ type: 'transaction-safe' });
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('load', runTransactionShield, { once: true });
} else {
  setTimeout(runTransactionShield, 1800);
}
