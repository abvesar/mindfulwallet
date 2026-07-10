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

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function runScanner() {
  if (!document.body) return;

  const bodyText = normalizeText(document.body.innerText);
  const detectedPatterns = deceptivePatterns.filter((pattern) => pattern.pattern.test(bodyText));

  const shouldAlert =
    detectedPatterns.length >= 2 ||
    detectedPatterns.some((pattern) => highConfidenceTypes.has(pattern.type));

  if (shouldAlert) {
    const uniquePatterns = [...new Set(detectedPatterns.map((pattern) => pattern.type))];
    highlightTextOnPage(detectedPatterns);
    injectSafetyBanner(uniquePatterns);
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
  window.addEventListener("load", runScanner, { once: true });
} else {
  setTimeout(runScanner, 1500);
}
