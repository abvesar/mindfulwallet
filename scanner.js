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

  chrome.storage.local.get(["settings"], (data) => {
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
      chrome.runtime.sendMessage({ type: "scanner-alert", patterns: uniquePatterns });
    }
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
  // Add this inside your scanner.js file
function blindfoldSponsoredAds() {
  // Look for elements commonly used by social networks for ads
  const posts = document.querySelectorAll('div, article, section');
  
  posts.forEach(post => {
    const text = post.innerText.toLowerCase();
    // If a post contains gambling keywords or is an ad, blur it!
    if (text.includes('sponsored') && (text.includes('bet') || text.includes('casino') || text.includes('crypto win'))) {
      post.style.filter = 'blur(10px)';
      post.style.pointerEvents = 'none'; // Make it unclickable
      console.log("🛡️ MindfulWallet blurred a predatory social media ad!");
    }
  });
}

// Run this scan every 3 seconds to catch infinite scrolling feeds
setInterval(blindfoldSponsoredAds, 3000);

// A verified registry of mega-brands that scammers frequently impersonate
const globalBrandsRegistry = [
  { name: "nike", officialDomain: "nike.com" },
  { name: "adidas", officialDomain: "adidas.com" },
  { name: "amazon", officialDomain: "amazon.com" },
  { name: "apple", officialDomain: "apple.com" }
];

function differentiateAds() {
  // Find all sponsored or ad elements on the social feed
  const adsOnPage = document.querySelectorAll('div[data-testid="placement-tracking"], iframe, .sponsored-ad-card');

  adsOnPage.forEach(ad => {
    const adText = ad.innerText.toLowerCase();
    const destinationLink = ad.querySelector('a')?.href.toLowerCase();

    if (destinationLink) {
      globalBrandsRegistry.forEach(brand => {
        // If the ad text mentions a major brand (e.g., "Nike sale!") 
        // but the actual hyperlink goes somewhere else entirely...
        if (adText.includes(brand.name) && !destinationLink.includes(brand.officialDomain)) {
          
          // 🚨 CONFIRMED FAKE AD: Apply the red flag styling!
          ad.style.border = "4px solid #d32f2f";
          ad.style.backgroundColor = "#ffebee";
          ad.style.position = "relative";

          // Inject a label over the ad frame so the youth sees the trick
          const alertTag = document.createElement('div');
          alertTag.innerText = `⚠️ MINDFULWALLET: Fake Ad Detected! Claims to be ${brand.name} but links to an unverified domain.`;
          alertTag.style.cssText = "position:absolute; top:0; background:#d32f2f; color:white; font-weight:bold; padding:5px; font-size:11px; z-index:99;";
          ad.prepend(alertTag);
        }
      });
    }
  });
}

// Run this scan loop as the user scrolls their social media feeds
setInterval(differentiateAds, 2500);

}
