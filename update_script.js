const fs = require("fs");
const https = require("https");

const DEVTO_API_KEY = process.env.DEVTO_API_KEY;
const README_FILE = "README.md";
const START_MARKER = "<!-- DEVTO-FOLLOWERS-COUNT:START -->";
const END_MARKER = "<!-- DEVTO-FOLLOWERS-COUNT:END -->";
const USER_AGENT = "Varshithvhegde-GitHub-Actions";

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

const updateReadme = async () => {
  const count = await getFollowersCount();
  let readmeContent = fs.readFileSync(README_FILE, "utf8");
  const newContent = `${START_MARKER}**${count}** DEV.to followers${END_MARKER}`;

  const regex = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`, "g");
  readmeContent = readmeContent.replace(regex, newContent);

  fs.writeFileSync(README_FILE, readmeContent);
  console.log("README updated with new follower count:", count);
};

updateReadme().catch((error) => {
  console.error(error);
  process.exit(1);
});
