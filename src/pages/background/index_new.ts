chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Keep other message types intact
  if (request.type === "CHECK_LINKEDIN_LOGIN") {
    chrome.cookies.get(
      { url: "https://www.linkedin.com", name: "li_at" },
      (cookie) => {
        sendResponse({ loggedIn: !!(cookie && cookie.value) });
      }
    );
    return true;
  }

  if (request.type === "GO_TO_LINKEDIN_SEARCH") {
    // Use invisible background scraping with fetch API
    scrapeLinkedInInvisibly(request.query);
    sendResponse({ status: "scraping_started" });
  }

  return false;
});

async function scrapeLinkedInInvisibly(searchQuery: string) {
  try {
    console.log("🕵️ Starting invisible LinkedIn scraping...");

    // Get LinkedIn cookies for authentication
    const cookies = await getAllLinkedInCookies();
    if (!cookies.length) {
      console.error("No LinkedIn cookies found. User must be logged in.");
      notifyPopup("error", "Please log in to LinkedIn first");
      return;
    }

    // Try multiple LinkedIn endpoints for better results
    const endpoints = [
      `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
        searchQuery
      )}`,
      `https://www.linkedin.com/feed/`,
      `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
        searchQuery
      )}`,
    ];

    for (const url of endpoints) {
      try {
        const posts = await scrapeLinkedInURL(url, cookies);
        if (posts.length > 0) {
          console.log(`✅ Found ${posts.length} posts from ${url}`);
          notifyPopup("success", posts);
          return;
        }
      } catch (error) {
        console.log(`Failed to scrape ${url}:`, error);
        continue;
      }
    }

    // Fallback: create a very brief hidden tab
    console.log("Falling back to hidden tab method...");
    await createMinimalHiddenTab(searchQuery);
  } catch (error) {
    console.error("Error in invisible scraping:", error);
    notifyPopup("error", "Failed to scrape LinkedIn");
  }
}

async function getAllLinkedInCookies(): Promise<chrome.cookies.Cookie[]> {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: ".linkedin.com" }, (cookies) => {
      resolve(cookies || []);
    });
  });
}

async function scrapeLinkedInURL(
  url: string,
  cookies: chrome.cookies.Cookie[]
): Promise<any[]> {
  return new Promise(async (resolve, reject) => {
    try {
      // Create cookie header
      const cookieHeader = cookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");

      // Fetch LinkedIn page with user's cookies
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Cookie: cookieHeader,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          DNT: "1",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const posts = parseLinkedInHTML(html);
      resolve(posts);
    } catch (error) {
      reject(error);
    }
  });
}

function parseLinkedInHTML(html: string): any[] {
  try {
    // Create a temporary DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const posts: any[] = [];

    // Look for LinkedIn post patterns in the HTML
    const postSelectors = [
      ".feed-shared-update-v2",
      ".artdeco-card",
      ".update-components-update",
      '[data-urn*="urn:li:activity"]',
      ".search-result__wrapper",
    ];

    postSelectors.forEach((selector) => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((element, index) => {
        const text = element.textContent?.trim() || "";
        if (text.length > 50) {
          // Only consider substantial content

          // Extract relevant data
          const post = {
            id: `fetch_${Date.now()}_${index}`,
            content: text,
            author: {
              name: extractAuthorName(element),
              title: extractAuthorTitle(element),
              profileUrl: extractAuthorProfile(element),
              imageUrl: extractAuthorImage(element),
            },
            postUrl: extractPostUrl(element),
            timestamp: new Date().toISOString(),
            likes: extractEngagement(element, "likes"),
            comments: extractEngagement(element, "comments"),
            shares: extractEngagement(element, "shares"),
            matchedKeywords: findMatchedKeywords(text),
            snippet: text.slice(0, 200),
          };

          if (post.matchedKeywords.length > 0) {
            posts.push(post);
          }
        }
      });
    });

    return posts;
  } catch (error) {
    console.error("Error parsing LinkedIn HTML:", error);
    return [];
  }
}

function extractAuthorName(element: Element): string {
  const selectors = [
    ".update-components-actor__name",
    ".feed-shared-actor__name",
    ".search-result__info .actor-name",
    ".entity-result__title-text",
  ];

  for (const selector of selectors) {
    const nameElement = element.querySelector(selector);
    if (nameElement?.textContent?.trim()) {
      return nameElement.textContent.trim();
    }
  }
  return "Unknown Author";
}

function extractAuthorTitle(element: Element): string {
  const selectors = [
    ".update-components-actor__description",
    ".feed-shared-actor__description",
    ".search-result__info .subline-level-1",
    ".entity-result__primary-subtitle",
  ];

  for (const selector of selectors) {
    const titleElement = element.querySelector(selector);
    if (titleElement?.textContent?.trim()) {
      return titleElement.textContent.trim();
    }
  }
  return "";
}

function extractAuthorProfile(element: Element): string {
  const linkElement = element.querySelector(
    'a[href*="/in/"]'
  ) as HTMLAnchorElement;
  return linkElement?.href || "";
}

function extractAuthorImage(element: Element): string {
  const imgElement = element.querySelector("img") as HTMLImageElement;
  return imgElement?.src || "";
}

function extractPostUrl(element: Element): string {
  const linkElement = element.querySelector(
    'a[href*="/posts/"], a[href*="/activity/"]'
  ) as HTMLAnchorElement;
  return linkElement?.href || "";
}

function extractEngagement(element: Element, type: string): number {
  const selectors = [
    `.social-counts-${type}`,
    `.feed-shared-social-action-bar__${type}`,
    `[aria-label*="${type}"]`,
  ];

  for (const selector of selectors) {
    const engagementElement = element.querySelector(selector);
    if (engagementElement?.textContent) {
      const match = engagementElement.textContent.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    }
  }
  return 0;
}

function findMatchedKeywords(text: string): string[] {
  // Import profile data keywords (we'll need to access this)
  const keywords = [
    "JavaScript",
    "React",
    "Next.js",
    "HTML",
    "CSS",
    "TypeScript",
    "VSCode",
    "Figma",
    "Chrome DevTools",
    "Git",
    "Webpack",
    "Remote jobs",
    "Startup culture",
    "React projects",
    "Frontend",
    "Full Stack",
  ];

  return keywords.filter((keyword) =>
    text.toLowerCase().includes(keyword.toLowerCase())
  );
}

async function createMinimalHiddenTab(searchQuery: string) {
  try {
    const url = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
      searchQuery
    )}`;

    // Create window in minimized state
    const window = await chrome.windows.create({
      url,
      state: "minimized",
      focused: false,
      width: 1,
      height: 1,
      left: -9999,
      top: -9999,
    });

    if (window && window.tabs && window.tabs[0]) {
      const tab = window.tabs[0];

      // Wait for page to load then inject script
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          if (tab.id) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["src/pages/content/index.js"],
            });
          }

          // Close the hidden window quickly
          setTimeout(() => {
            if (window && window.id) {
              chrome.windows.remove(window.id);
            }
          }, 3000);

          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    }
  } catch (error) {
    console.error("Failed to create minimal hidden tab:", error);
  }
}

function notifyPopup(type: string, data: any) {
  if (type === "success") {
    chrome.runtime.sendMessage({
      type: "POSTS_FOUND",
      data: data,
      source: "invisible_scraping",
    });
  } else {
    chrome.runtime.sendMessage({
      type: "SCRAPING_ERROR",
      message: data,
    });
  }
}
