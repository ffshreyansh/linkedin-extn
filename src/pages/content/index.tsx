import { profileData } from "@src/profileData";

// Check if post contains any keyword
function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) =>
    text.toLowerCase().includes(keyword.toLowerCase())
  );
}

// Scan LinkedIn search results
function scanSearchResultsAndSend() {
  const posts = document.querySelectorAll(
    '.entity-result__summary, .update-components-text, .artdeco-card p, span[dir="ltr"]'
  );
  
  const matchedPosts: any[] = [];
  const allKeywords = [...profileData.skills, ...profileData.preferences];

  let matchCount = 0;

  posts.forEach((post) => {
    const text = post.textContent?.trim() || "";

    if (containsKeyword(text, allKeywords)) {
      // Try to find a valid parent link
      const postElement = post.closest("a") as HTMLAnchorElement;
      const url = postElement?.href || "No URL found";

      matchedPosts.push({
        snippet: text.slice(0, 200),
        url,
        timestamp: new Date().toISOString(),
      });

      matchCount++;
      if (matchCount >= 2) return; // Stop after 2
    }
  });

  if (matchedPosts.length > 0) {
    console.log("✅ Found matched posts:", matchedPosts);
    chrome.runtime.sendMessage({ type: "MATCHED_POSTS_DIRECT", data: matchedPosts });
  } else {
    console.log("ℹ️ No matched posts found.");
  }
}

// Delay scanning to allow LinkedIn search content to load
setTimeout(() => {
  console.log("🔍 Scanning LinkedIn search results...");
  scanSearchResultsAndSend();
}, 5000);
