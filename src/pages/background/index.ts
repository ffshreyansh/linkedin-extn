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
  const url = `https://www.linkedin.com/search/results/content/?keywords=${request.query}`;

  chrome.tabs.create({ url, active: false }, (tab) => {
    if (!tab?.id) return;

    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === "complete") {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["src/pages/content/index.js"],
        });

        chrome.tabs.onUpdated.removeListener(listener);
      }
    });

    // Listen for results and export
    chrome.runtime.onMessage.addListener(function handleMatchedPosts(msg) {
      if (msg.type === "MATCHED_POSTS_DIRECT") {
        chrome.runtime.sendMessage({
          type: "EXPORT_JSON",
          data: msg.data,
        });

        setTimeout(() => chrome.tabs.remove(tab.id!), 6000);
        chrome.runtime.onMessage.removeListener(handleMatchedPosts);
      }
    });
  });
}


  return false;
});
