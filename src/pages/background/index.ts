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
    // Try to use existing LinkedIn tabs first, then create hidden tab
    scrapeLinkedInInBackground(request.query);
  }

  return false;
});

async function scrapeLinkedInInBackground(searchQuery: string) {
  try {
    // First, check if user has any existing LinkedIn tabs
    const linkedInTabs = await chrome.tabs.query({
      url: "https://www.linkedin.com/*",
    });

    if (linkedInTabs.length > 0) {
      // Use existing LinkedIn tab
      const existingTab = linkedInTabs[0];
      console.log("Using existing LinkedIn tab for scraping");

      try {
        await chrome.scripting.executeScript({
          target: { tabId: existingTab.id! },
          files: ["src/pages/content/index.js"],
        });

        // Listen for results
        setupMessageListener("existing-tab");
        return;
      } catch (error) {
        console.log("Failed to use existing tab, creating hidden tab:", error);
      }
    }

    // If no existing tabs or failed to use them, create a minimized hidden tab
    createHiddenLinkedInTab(searchQuery);
  } catch (error) {
    console.error("Error in background scraping:", error);
  }
}

function createHiddenLinkedInTab(searchQuery: string) {
  // Create tab with minimal visibility
  const feedUrl = "https://www.linkedin.com/feed/";

  chrome.tabs.create(
    {
      url: feedUrl,
      active: false,
      pinned: false,
    },
    async (tab) => {
      if (!tab?.id) return;

      const tabId = tab.id;

      try {
        // Immediately minimize the window to hide it better
        const window = await chrome.windows.get(tab.windowId);
        await chrome.windows.update(tab.windowId, {
          state: "minimized",
          focused: false,
        });
      } catch (error) {
        console.log("Could not minimize window:", error);
      }

      let hasFoundPosts = false;
      const timeoutDuration = 8000;

      // Set a timeout for the operation
      const operationTimeout = setTimeout(() => {
        if (!hasFoundPosts) {
          console.log("Scraping timeout, closing tab");
          chrome.tabs.remove(tabId);
        }
      }, timeoutDuration);

      chrome.tabs.onUpdated.addListener(function feedListener(
        updatedTabId,
        info
      ) {
        if (updatedTabId === tabId && info.status === "complete") {
          // Wait for content to load, then inject script
          setTimeout(() => {
            chrome.scripting
              .executeScript({
                target: { tabId },
                files: ["src/pages/content/index.js"],
              })
              .catch((error) => {
                console.error("Failed to inject content script:", error);
                clearTimeout(operationTimeout);
                chrome.tabs.remove(tabId);
              });
          }, 2000);

          chrome.tabs.onUpdated.removeListener(feedListener);
        }
      });

      // Listen for results
      const messageListener = (msg: any) => {
        if (msg.type === "MATCHED_POSTS_DIRECT") {
          hasFoundPosts = true;
          clearTimeout(operationTimeout);

          // Send results to popup
          chrome.runtime.sendMessage({
            type: "POSTS_FOUND",
            data: msg.data,
            source: "background-scraping",
          });

          // Close the tab quickly
          chrome.tabs.remove(tabId);
          chrome.runtime.onMessage.removeListener(messageListener);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
    }
  );
}

function setupMessageListener(source: string) {
  const messageListener = (msg: any) => {
    if (msg.type === "MATCHED_POSTS_DIRECT") {
      // Send results to popup
      chrome.runtime.sendMessage({
        type: "POSTS_FOUND",
        data: msg.data,
        source: source,
      });

      chrome.runtime.onMessage.removeListener(messageListener);
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // Clean up listener after timeout
  setTimeout(() => {
    chrome.runtime.onMessage.removeListener(messageListener);
  }, 15000);
}
