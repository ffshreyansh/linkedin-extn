//@ts-nocheck

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
    console.log("🕵️ Starting LinkedIn scraping...");

    // Get LinkedIn cookies for authentication check
    const cookies = await getAllLinkedInCookies();
    if (!cookies.length) {
      console.error("No LinkedIn cookies found. User must be logged in.");
      notifyPopup("error", "Please log in to LinkedIn first");
      return;
    }

    // First, try to find existing LinkedIn tabs
    const existingLinkedInTabs = await findLinkedInTabs();

    if (existingLinkedInTabs.length > 0) {
      console.log("Found existing LinkedIn tab, injecting content script...");
      await injectScriptIntoTab(existingLinkedInTabs[0].id!, searchQuery);
      return;
    }

    // If no existing tabs, create a new tab with LinkedIn search
    console.log("Creating new LinkedIn tab for scraping...");
    await createLinkedInScrapingTab(searchQuery);
  } catch (error) {
    console.error("Error in LinkedIn scraping:", error);
    notifyPopup("error", "Failed to scrape LinkedIn");
  }
}

async function findLinkedInTabs(): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
      resolve(tabs || []);
    });
  });
}

async function injectScriptIntoTab(tabId: number, searchQuery: string) {
  try {
    // Navigate to LinkedIn search page
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
      searchQuery
    )}`;

    await chrome.tabs.update(tabId, { url: searchUrl });

    // Wait for navigation and inject script
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.scripting
          .executeScript({
            target: { tabId },
            func: scrapeCurrentPage,
            args: [searchQuery],
          })
          .then(() => {
            console.log("Content script injected successfully");
          })
          .catch((error) => {
            console.error("Failed to inject content script:", error);
            notifyPopup("error", "Failed to inject scraping script");
          });

        chrome.tabs.onUpdated.removeListener(listener);
      }
    });
  } catch (error) {
    console.error("Failed to inject script into existing tab:", error);
    notifyPopup("error", "Failed to access LinkedIn tab");
  }
}

async function createLinkedInScrapingTab(searchQuery: string) {
  try {
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
      searchQuery
    )}`;

    const tab = await chrome.tabs.create({
      url: searchUrl,
      active: false, // Don't focus the tab
    });

    if (tab.id) {
      // Wait for the tab to load completely
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id! },
              func: scrapeCurrentPage,
              args: [searchQuery],
            })
            .then(() => {
              console.log("Content script injected into new tab");
              // Close the tab after a delay
              setTimeout(() => {
                if (tab.id) {
                  chrome.tabs.remove(tab.id);
                }
              }, 5000);
            })
            .catch((error) => {
              console.error("Failed to inject content script:", error);
              notifyPopup("error", "Failed to inject scraping script");
            });

          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    }
  } catch (error) {
    console.error("Failed to create LinkedIn scraping tab:", error);
    notifyPopup("error", "Failed to create LinkedIn tab");
  }
}

// This function will be injected into the LinkedIn page
function scrapeCurrentPage(searchQuery: string) {
  console.log("🔍 Scraping LinkedIn page for:", searchQuery);

  const posts: any[] = [];

  // LinkedIn post selectors
  const postSelectors = [
    ".feed-shared-update-v2",
    ".update-components-update",
    "[data-urn*='urn:li:activity']",
    ".search-result__wrapper",
  ];

  postSelectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    console.log(`Found ${elements.length} elements with selector: ${selector}`);

    elements.forEach((element, index) => {
      const textContent = element.textContent?.trim() || "";

      if (textContent.length > 50) {
        // Extract post data
        const authorElement = element.querySelector(
          ".update-components-actor__name, .feed-shared-actor__name"
        );
        const titleElement = element.querySelector(
          ".update-components-actor__description, .feed-shared-actor__description"
        );
        const linkElement = element.querySelector(
          "a[href*='/in/']"
        ) as HTMLAnchorElement;

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
        const matchedKeywords = keywords.filter((keyword) =>
          textContent.toLowerCase().includes(keyword.toLowerCase())
        );

        if (matchedKeywords.length > 0) {
          const post = {
            id: `scraped_${Date.now()}_${index}`,
            content: textContent,
            author: {
              name: authorElement?.textContent?.trim() || "Unknown Author",
              title: titleElement?.textContent?.trim() || "",
              profileUrl: linkElement?.href || "",
              imageUrl: "",
            },
            postUrl: window.location.href,
            timestamp: new Date().toISOString(),
            likes: 0,
            comments: 0,
            shares: 0,
            matchedKeywords,
            snippet: textContent.slice(0, 200),
          };

          posts.push(post);
        }
      }
    });
  });

  console.log(`Found ${posts.length} relevant posts`);

  // Send results back to background script
  chrome.runtime.sendMessage({
    type: "POSTS_FOUND",
    data: posts,
    source: "content_script_scraping",
  });
}

async function getAllLinkedInCookies(): Promise<chrome.cookies.Cookie[]> {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: ".linkedin.com" }, (cookies) => {
      resolve(cookies || []);
    });
  });
}

function parseLinkedInHTML(html: string): any[] {
  try {
    // Since DOMParser is not available in service workers, use regex patterns
    // to extract post content from LinkedIn HTML
    const posts: any[] = [];

    // Look for LinkedIn post patterns using regex
    const postPatterns = [
      // LinkedIn feed posts
      /<article[^>]*class="[^"]*feed-shared-update-v2[^"]*"[^>]*>(.*?)<\/article>/gs,
      // LinkedIn search results
      /<div[^>]*class="[^"]*search-result__wrapper[^"]*"[^>]*>(.*?)<\/div>/gs,
      // LinkedIn activity posts
      /<div[^>]*data-urn[^>]*urn:li:activity[^>]*>(.*?)<\/div>/gs,
    ];

    let postIndex = 0;

    postPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(html)) !== null && postIndex < 20) {
        // Limit to 20 posts
        const postHTML = match[1];

        // Extract text content by removing HTML tags
        const textContent = postHTML
          .replace(/<script[^>]*>.*?<\/script>/gs, "")
          .replace(/<style[^>]*>.*?<\/style>/gs, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (textContent.length > 50) {
          // Extract author name using regex
          const authorName = extractAuthorNameFromHTML(postHTML);
          const authorTitle = extractAuthorTitleFromHTML(postHTML);
          const profileUrl = extractProfileUrlFromHTML(postHTML);
          const postUrl = extractPostUrlFromHTML(postHTML);

          const post = {
            id: `fetch_${Date.now()}_${postIndex}`,
            content: textContent,
            author: {
              name: authorName || "Unknown Author",
              title: authorTitle || "",
              profileUrl: profileUrl || "",
              imageUrl: "",
            },
            postUrl: postUrl || "",
            timestamp: new Date().toISOString(),
            likes: extractEngagementFromHTML(postHTML, "likes"),
            comments: extractEngagementFromHTML(postHTML, "comments"),
            shares: extractEngagementFromHTML(postHTML, "shares"),
            matchedKeywords: findMatchedKeywords(textContent),
            snippet: textContent.slice(0, 200),
          };

          if (post.matchedKeywords.length > 0) {
            posts.push(post);
            postIndex++;
          }
        }
      }
    });

    return posts;
  } catch (error) {
    console.error("Error parsing LinkedIn HTML:", error);
    return [];
  }
}

function extractAuthorNameFromHTML(html: string): string {
  const patterns = [
    /class="[^"]*update-components-actor__name[^"]*"[^>]*>([^<]+)</,
    /class="[^"]*feed-shared-actor__name[^"]*"[^>]*>([^<]+)</,
    /class="[^"]*actor-name[^"]*"[^>]*>([^<]+)</,
    /class="[^"]*entity-result__title-text[^"]*"[^>]*>([^<]+)</,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }
  return "Unknown Author";
}

function extractAuthorTitleFromHTML(html: string): string {
  const patterns = [
    /class="[^"]*update-components-actor__description[^"]*"[^>]*>([^<]+)</,
    /class="[^"]*feed-shared-actor__description[^"]*"[^>]*>([^<]+)</,
    /class="[^"]*subline-level-1[^"]*"[^>]*>([^<]+)</,
    /class="[^"]*entity-result__primary-subtitle[^"]*"[^>]*>([^<]+)</,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }
  return "";
}

function extractProfileUrlFromHTML(html: string): string {
  const match = html.match(/href="([^"]*\/in\/[^"]+)"/);
  return match ? match[1] : "";
}

function extractPostUrlFromHTML(html: string): string {
  const patterns = [
    /href="([^"]*\/posts\/[^"]+)"/,
    /href="([^"]*\/activity\/[^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return "";
}

function extractEngagementFromHTML(html: string, type: string): number {
  const patterns = [
    new RegExp(`class="[^"]*social-counts-${type}[^"]*"[^>]*>([^<]+)`, "i"),
    new RegExp(
      `class="[^"]*feed-shared-social-action-bar__${type}[^"]*"[^>]*>([^<]+)`,
      "i"
    ),
    new RegExp(`aria-label="[^"]*${type}[^"]*"[^>]*>([^<]+)`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const numberMatch = match[1].match(/\d+/);
      return numberMatch ? parseInt(numberMatch[0]) : 0;
    }
  }
  return 0;
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

function notifyPopup(type: string, data: any) {
  if (type === "success") {
    chrome.runtime.sendMessage({
      type: "POSTS_FOUND",
      data: data,
      source: "content_script_scraping",
    });
  } else {
    chrome.runtime.sendMessage({
      type: "SCRAPING_ERROR",
      message: data,
    });
  }
}
