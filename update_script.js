const fs = require("fs");
const https = require("https");

const DEVTO_API_KEY = process.env.DEVTO_API_KEY;
const SVG_FILE = "devto-followers.svg";
const USER_AGENT = "Varshithvhegde-GitHub-Actions";

const SVG_TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="110" viewBox="0 0 360 110" role="img" aria-label="DEV.to followers">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1b27"/>
      <stop offset="100%" stop-color="#24283b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7aa2f7"/>
      <stop offset="100%" stop-color="#bb9af7"/>
    </linearGradient>
  </defs>

  <!-- Card -->
  <rect x="1" y="1" width="358" height="108" rx="16" fill="url(#cardBg)" stroke="#3b4261" stroke-width="1.5"/>

  <!-- DEV logo -->
  <rect x="24" y="31" width="48" height="48" rx="10" fill="#0A0A0A" stroke="#3b4261" stroke-width="1"/>
  <text x="48" y="61" font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">DEV</text>

  <!-- Follower count -->
  <text id="followers-count" x="92" y="62" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="800" fill="url(#accent)">0</text>

  <!-- Label -->
  <text x="92" y="84" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="600" letter-spacing="2" fill="#9aa5ce">FOLLOWERS ON DEV.TO</text>

  <!-- Heart -->
  <path transform="translate(318, 44) scale(1.1)" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#f7768e"/>
</svg>
`;

if (!DEVTO_API_KEY) {
  throw new Error("Missing required DEVTO_API_KEY environment variable.");
}

const parseResponsePreview = (data) => {
  const trimmed = data.trim();
  return trimmed ? trimmed.slice(0, 500) : "<empty>";
};

const fetchJson = (path) => {
  const options = {
    hostname: "dev.to",
    port: 443,
    path,
    method: "GET",
    headers: {
      "api-key": DEVTO_API_KEY,
      Accept: "application/vnd.forem.api-v1+json",
      "User-Agent": USER_AGENT,
    },
    timeout: 15000,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode !== 200) {
          const preview = parseResponsePreview(data);
          reject(
            new Error(
              `DEV.to API request failed (${res.statusCode} ${res.statusMessage || "Unknown"}). Response preview: ${preview}`
            )
          );
          return;
        }

        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse API response. Response data: ${data}`));
        }
      });
    });

    req.on("timeout", () => req.destroy(new Error("DEV.to API request timed out.")));
    req.on("error", reject);
    req.end();
  });
};

const getFollowersCount = async () => {
  const perPage = 1000;
  let page = 1;
  let totalCount = 0;

  while (true) {
    const followers = await fetchJson(
      `/api/followers/users?page=${page}&per_page=${perPage}`
    );

    if (!Array.isArray(followers)) {
      throw new Error("DEV.to followers endpoint returned an invalid response.");
    }

    totalCount += followers.length;

    if (followers.length < perPage) {
      return totalCount;
    }

    page += 1;
  }
};

const updateSvg = async () => {
  const count = await getFollowersCount();
  const formatted = count.toLocaleString("en-US");

  const svg = SVG_TEMPLATE.replace(
    /(<text id="followers-count"[^>]*>)[^<]*(<\/text>)/,
    `$1${formatted}$2`
  );

  fs.writeFileSync(SVG_FILE, svg);
  console.log("Badge updated with new follower count:", formatted);
};

updateSvg().catch((error) => {
  console.error(error);
  process.exit(1);
});
