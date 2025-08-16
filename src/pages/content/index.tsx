import { profileData } from "@src/profileData";

interface LinkedInPost {
  id: string;
  content: string;
  author: {
    name: string;
    title: string;
    profileUrl: string;
    imageUrl: string;
  };
  postUrl: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  matchedKeywords: string[];
  snippet: string;
}

// Check if post contains any keyword
function containsKeyword(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) =>
    text.toLowerCase().includes(keyword.toLowerCase())
  );
}

// Extract post data from LinkedIn feed
function extractPostData(postElement: Element): LinkedInPost | null {
  try {
    // Generate unique ID
    const id = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Extract post content - try multiple selectors
    const contentSelectors = [
      ".feed-shared-update-v2__description",
      ".update-components-text",
      ".feed-shared-text",
      ".feed-shared-update-v2__description .break-words",
      ".feed-shared-update-v2__description-wrapper .break-words",
      "[data-test-id='post-text']",
      ".attributed-text-segment-list__content",
    ];

    let content = "";
    for (const selector of contentSelectors) {
      const element = postElement.querySelector(selector);
      if (element?.textContent?.trim()) {
        content = element.textContent.trim();
        break;
      }
    }

    // If no content found, try getting any text from the element
    if (!content) {
      content = postElement.textContent?.trim().substring(0, 500) || "";
    }

    // Extract author information - try multiple selectors
    const authorSelectors = [
      ".update-components-actor__name",
      ".feed-shared-actor__name",
      ".update-components-actor__title",
      ".feed-shared-actor__title",
      "[data-test-id='author-name']",
    ];

    let authorName = "Unknown Author";
    for (const selector of authorSelectors) {
      const element = postElement.querySelector(selector);
      if (element?.textContent?.trim()) {
        authorName = element.textContent.trim();
        break;
      }
    }

    const authorTitleSelectors = [
      ".update-components-actor__description",
      ".feed-shared-actor__description",
      ".update-components-actor__sub-description",
      ".feed-shared-actor__sub-description",
    ];

    let authorTitle = "";
    for (const selector of authorTitleSelectors) {
      const element = postElement.querySelector(selector);
      if (element?.textContent?.trim()) {
        authorTitle = element.textContent.trim();
        break;
      }
    }

    const authorLinkElement = postElement.querySelector(
      ".update-components-actor__container a, .feed-shared-actor__container a, .update-components-actor__link"
    ) as HTMLAnchorElement;
    const authorProfileUrl = authorLinkElement?.href || "";

    const authorImageElement = postElement.querySelector(
      ".update-components-actor__avatar img, .feed-shared-actor__avatar img, .update-components-actor__avatar .presence-entity__image"
    ) as HTMLImageElement;
    const authorImageUrl = authorImageElement?.src || "";

    // Extract post URL - try multiple approaches
    let postUrl = window.location.href;
    const postLinkSelectors = [
      ".update-components-header__text-view a",
      ".feed-shared-control-menu__trigger",
      "[data-test-id='post-url']",
      "a[href*='/posts/']",
    ];

    for (const selector of postLinkSelectors) {
      const element = postElement.querySelector(selector) as HTMLAnchorElement;
      if (element?.href) {
        postUrl = element.href;
        break;
      }
    }

    // Extract engagement metrics
    const likesElement = postElement.querySelector(
      ".social-counts-reactions__count, .feed-shared-social-action-bar__reaction-count"
    );
    const likes = parseInt(
      likesElement?.textContent?.replace(/[^\d]/g, "") || "0"
    );

    const commentsElement = postElement.querySelector(
      ".social-counts-comments__count, .feed-shared-social-action-bar__comment-count"
    );
    const comments = parseInt(
      commentsElement?.textContent?.replace(/[^\d]/g, "") || "0"
    );

    const sharesElement = postElement.querySelector(
      ".social-counts-shares__count, .feed-shared-social-action-bar__share-count"
    );
    const shares = parseInt(
      sharesElement?.textContent?.replace(/[^\d]/g, "") || "0"
    );

    // Extract timestamp
    const timeElement = postElement.querySelector(
      "time, .update-components-actor__sub-description time, [data-test-id='post-time']"
    );
    const timestamp =
      timeElement?.getAttribute("datetime") || new Date().toISOString();

    return {
      id,
      content,
      author: {
        name: authorName,
        title: authorTitle,
        profileUrl: authorProfileUrl,
        imageUrl: authorImageUrl,
      },
      postUrl,
      timestamp,
      likes,
      comments,
      shares,
      matchedKeywords: [],
      snippet: content.slice(0, 200),
    };
  } catch (error) {
    console.error("Error extracting post data:", error);
    return null;
  }
}

// Scan LinkedIn feed for posts
function scanLinkedInFeed() {
  console.log("🔍 Scanning LinkedIn feed for posts...");

  // Updated LinkedIn post selectors for 2024/2025
  const postSelectors = [
    'div[data-urn*="urn:li:activity"]', // Main feed posts
    ".feed-shared-update-v2",
    ".feed-shared-update",
    "article[data-urn]",
    ".update-v2-social-activity",
    ".occludable-update",
    "div.feed-shared-update-v2__description-wrapper", // Post content wrapper
    '[data-id^="urn:li:activity"]', // Activity posts
  ];

  let posts: Element[] = [];

  // Try different selectors to find posts
  for (const selector of postSelectors) {
    const foundPosts = document.querySelectorAll(selector);
    if (foundPosts.length > 0) {
      posts = Array.from(foundPosts);
      console.log(`✅ Found ${posts.length} posts using selector: ${selector}`);
      break;
    }
  }

  // If no posts found with main selectors, try broader approach
  if (posts.length === 0) {
    console.log("ℹ️ Main selectors failed, trying broader search...");
    const allDivs = document.querySelectorAll("div");
    const potentialPosts = Array.from(allDivs).filter(
      (div) =>
        div.textContent &&
        div.textContent.length > 50 &&
        (div.className.includes("feed") ||
          div.className.includes("update") ||
          div.hasAttribute("data-urn"))
    );

    if (potentialPosts.length > 0) {
      posts = potentialPosts.slice(0, 10); // Limit to first 10 potential posts
      console.log(
        `✅ Found ${posts.length} potential posts using broad search`
      );
    }
  }

  if (posts.length === 0) {
    console.log("ℹ️ No posts found. Trying search results...");
    scanSearchResults();
    return;
  }

  const allKeywords = [
    ...profileData.skills,
    ...profileData.preferences,
    ...profileData.tools,
  ];
  const matchedPosts: LinkedInPost[] = [];

  posts.forEach((postElement, index) => {
    console.log(`📝 Processing post ${index + 1}/${posts.length}`);
    const postData = extractPostData(postElement);

    if (postData && postData.content) {
      const matchedKeywords = containsKeyword(postData.content, allKeywords);

      // Lower threshold - match if any keyword found OR if content seems job-related
      const jobRelatedTerms = [
        "hiring",
        "job",
        "position",
        "opportunity",
        "developer",
        "engineer",
        "remote",
        "apply",
        "work",
        "team",
        "looking for",
        "join us",
      ];
      const hasJobTerms = containsKeyword(postData.content, jobRelatedTerms);

      if (matchedKeywords.length > 0 || hasJobTerms.length > 0) {
        postData.matchedKeywords = [...matchedKeywords, ...hasJobTerms];
        matchedPosts.push(postData);
        console.log(`✅ Found relevant post ${index + 1}:`, postData.snippet);
      } else {
        console.log(
          `⚠️ Post ${index + 1} didn't match criteria:`,
          postData.snippet.substring(0, 100)
        );
      }
    } else {
      console.log(`⚠️ Could not extract data from post ${index + 1}`);
    }
  });

  console.log(`📊 Total matched posts: ${matchedPosts.length}`);
  sendPostsToPopup(matchedPosts);
}

// Fallback: Scan search results if feed scanning fails
function scanSearchResults() {
  console.log("🔍 Scanning LinkedIn search results...");

  // Updated selectors for LinkedIn search results and job listings
  const searchSelectors = [
    ".entity-result__summary",
    ".update-components-text",
    ".artdeco-card p",
    'span[dir="ltr"]',
    ".search-result__wrapper",
    ".job-search-card",
    ".jobs-search__results .result-card",
    ".jobs-search-results__list-item",
    ".reusable-search__result-container",
    ".search-results-container .result-card__contents",
  ];

  let searchResults: Element[] = [];

  for (const selector of searchSelectors) {
    const found = document.querySelectorAll(selector);
    if (found.length > 0) {
      searchResults = Array.from(found);
      console.log(
        `✅ Found ${searchResults.length} search results using: ${selector}`
      );
      break;
    }
  }

  const matchedPosts: LinkedInPost[] = [];
  const allKeywords = [
    ...profileData.skills,
    ...profileData.preferences,
    ...profileData.tools,
  ];

  // Add job-specific keywords to increase matches
  const jobKeywords = [
    "developer",
    "engineer",
    "frontend",
    "backend",
    "full stack",
    "javascript",
    "react",
    "node",
    "python",
    "remote",
    "hybrid",
    "hiring",
    "join our team",
  ];

  searchResults.forEach((element, index) => {
    const text = element.textContent?.trim() || "";
    if (text.length < 10) return; // Skip too short content

    const matchedSkills = containsKeyword(text, allKeywords);
    const matchedJobTerms = containsKeyword(text, jobKeywords);
    const allMatched = [...matchedSkills, ...matchedJobTerms];

    if (allMatched.length > 0) {
      const postElement = element.closest("a") as HTMLAnchorElement;
      const url = postElement?.href || window.location.href;

      // Try to extract more info from the parent elements
      const parentCard = element.closest(
        ".entity-result, .result-card, .job-search-card, .reusable-search__result-container"
      );
      const authorElement = parentCard?.querySelector(
        ".entity-result__title-text a, .result-card__title a, .job-search-card__title a"
      );
      const authorName = authorElement?.textContent?.trim() || "LinkedIn User";

      const post: LinkedInPost = {
        id: `search_${Date.now()}_${index}`,
        content: text,
        author: {
          name: authorName,
          title: "",
          profileUrl: "",
          imageUrl: "",
        },
        postUrl: url,
        timestamp: new Date().toISOString(),
        likes: 0,
        comments: 0,
        shares: 0,
        matchedKeywords: allMatched,
        snippet: text.slice(0, 200),
      };

      matchedPosts.push(post);
      console.log(`✅ Found search result ${index + 1}:`, post.snippet);
    }
  });

  console.log(`📊 Total search results matched: ${matchedPosts.length}`);
  sendPostsToPopup(matchedPosts);
}

// Send posts to popup and storage
function sendPostsToPopup(posts: LinkedInPost[]) {
  const pageType = window.location.href.includes("/feed/") ? "feed" : "search";

  if (posts.length > 0) {
    console.log(`✅ Found ${posts.length} matched posts:`, posts);

    // Save to storage
    chrome.storage.local.set({
      matchedPosts: posts,
      lastScanTime: new Date().toISOString(),
    });

    // Send message to background/popup with page type
    chrome.runtime.sendMessage({
      type: "MATCHED_POSTS_DIRECT",
      data: posts,
      sender: pageType,
    });
  } else {
    console.log("ℹ️ No matched posts found.");
    chrome.storage.local.set({
      matchedPosts: [],
      lastScanTime: new Date().toISOString(),
    });

    // Send empty result to close tab
    chrome.runtime.sendMessage({
      type: "MATCHED_POSTS_DIRECT",
      data: [],
      sender: pageType,
    });
  }
}

// Initialize scanning based on page type
function initializeScanning() {
  console.log("🚀 LinkedIn Extension: Content script loaded");

  // Wait for page to load completely
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(startScanning, 2000);
    });
  } else {
    setTimeout(startScanning, 2000);
  }
}

function startScanning() {
  // Check if we're on a search results page or feed page
  if (window.location.href.includes("/search/results/")) {
    console.log("📍 Detected search results page");
    setTimeout(scanSearchResults, 3000);
  } else if (
    window.location.href.includes("/feed/") ||
    window.location.pathname === "/"
  ) {
    console.log("📍 Detected feed page");
    setTimeout(scanLinkedInFeed, 3000);
  } else {
    console.log("📍 Other LinkedIn page, attempting general scan");
    setTimeout(scanLinkedInFeed, 3000);
  }
}

// Initialize the extension
initializeScanning();
