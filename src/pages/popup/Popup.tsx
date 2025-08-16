import { useEffect, useState } from "react";
import logo from "@assets/img/logo.svg";
import { profileData } from "@src/profileData";
import PostCard from "@src/components/PostCard";

interface Author {
  name: string;
  title: string;
  profileUrl: string;
  imageUrl: string;
}

interface LinkedInPost {
  id: string;
  content: string;
  author: Author;
  postUrl: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  matchedKeywords: string[];
  snippet: string;
}

export default function Popup() {
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [checking, setChecking] = useState(false);
  const [matchedPosts, setMatchedPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"scan" | "posts">("scan");

  useEffect(() => {
    // Check LinkedIn connection status and load posts
    if (chrome?.storage?.local) {
      chrome.storage.local.get(
        ["linkedinConnected", "matchedPosts", "lastScanTime"],
        (result) => {
          if (result.linkedinConnected) {
            setLinkedinConnected(true);
          }

          // Load matched posts
          if (result.matchedPosts && Array.isArray(result.matchedPosts)) {
            setMatchedPosts(result.matchedPosts);
            console.log("� Loaded Posts:", result.matchedPosts);

            // Switch to posts tab if we have posts
            if (result.matchedPosts.length > 0) {
              setActiveTab("posts");
            }
          }

          if (result.lastScanTime) {
            setLastScanTime(result.lastScanTime);
          }
        }
      );
    } else {
      console.error("❌ chrome.storage.local is not available");
    }
  }, []);

  useEffect(() => {
    // Listen for new posts from content script
    const messageListener = (message: any) => {
      if (
        (message.type === "MATCHED_POSTS_DIRECT" ||
          message.type === "POSTS_FOUND") &&
        message.data
      ) {
        setMatchedPosts(message.data);
        setLoading(false);
        if (message.data.length > 0) {
          setActiveTab("posts");
        }

        // Save to storage
        chrome.storage.local.set({
          matchedPosts: message.data,
          lastScanTime: new Date().toISOString(),
        });
      }

      if (message.type === "EXPORT_JSON" && message.data) {
        const json = JSON.stringify(message.data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "linkedin_matched_posts.json";
        a.click();
        URL.revokeObjectURL(url);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const handleLinkedInConnect = async () => {
    setChecking(true);
    chrome.runtime.sendMessage({ type: "CHECK_LINKEDIN_LOGIN" }, (response) => {
      setChecking(false);
      if (response && response.loggedIn) {
        chrome.storage.local.set({ linkedinConnected: true }, () => {
          console.log("✅ linkedinConnected set in storage");
          setLinkedinConnected(true);
        });
      } else {
        setLinkedinConnected(false);
        chrome.storage.local.remove("linkedinConnected");
        alert("Please log in to LinkedIn and try again.");
      }
    });
  };

  const handleScan = () => {
    setLoading(true);
    setMatchedPosts([]); // Clear previous posts

    const allKeywords = [
      ...profileData.skills,
      ...profileData.preferences,
      ...profileData.tools,
    ];
    const searchQuery = encodeURIComponent(allKeywords[0]); // Use the first keyword

    chrome.runtime.sendMessage({
      type: "GO_TO_LINKEDIN_SEARCH",
      query: searchQuery,
    });
  };

  // Add test function to show mock posts
  const handleShowTestPosts = () => {
    const mockPosts: LinkedInPost[] = [
      {
        id: "test_1",
        content:
          "Looking for a React developer with experience in TypeScript and Next.js. Remote position available. Great opportunity to work with cutting-edge technology!",
        author: {
          name: "Sarah Johnson",
          title: "Senior Tech Recruiter at Tech Corp",
          profileUrl: "https://linkedin.com/in/sarah-johnson",
          imageUrl:
            "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y",
        },
        postUrl: "https://linkedin.com/posts/sarah-johnson-123",
        timestamp: new Date().toISOString(),
        likes: 45,
        comments: 12,
        shares: 8,
        matchedKeywords: ["React", "TypeScript", "Next.js"],
        snippet:
          "Looking for a React developer with experience in TypeScript and Next.js. Remote position available...",
      },
      {
        id: "test_2",
        content:
          "Just shipped a new feature using React and CSS animations. The power of modern frontend development never ceases to amaze me! Check out our live demo.",
        author: {
          name: "Mike Chen",
          title: "Frontend Developer at StartupXYZ",
          profileUrl: "https://linkedin.com/in/mike-chen",
          imageUrl:
            "https://www.gravatar.com/avatar/11111111111111111111111111111111?d=mp&f=y",
        },
        postUrl: "https://linkedin.com/posts/mike-chen-456",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        likes: 89,
        comments: 23,
        shares: 15,
        matchedKeywords: ["React", "CSS", "Frontend"],
        snippet:
          "Just shipped a new feature using React and CSS animations. The power of modern frontend development...",
      },
    ];

    setMatchedPosts(mockPosts);
    setActiveTab("posts");
    chrome.storage.local.set({
      matchedPosts: mockPosts,
      lastScanTime: new Date().toISOString(),
    });
  };

  const handleOpenPost = (url: string) => {
    chrome.tabs.create({ url, active: true });
  };

  const handleClearPosts = () => {
    setMatchedPosts([]);
    chrome.storage.local.remove(["matchedPosts", "lastScanTime"]);
    setActiveTab("scan");
  };

  const formatLastScanTime = (timestamp: string) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      return `Last scan: ${date.toLocaleTimeString()}`;
    } catch {
      return "";
    }
  };

  return (
    <div className="w-96 rounded-lg bg-gray-100 shadow-lg font-sans text-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <img src={logo} alt="Indy AI" className="h-6 w-6 rounded-full" />
        <span className="font-semibold text-gray-900">
          Sydney{" "}
          <span className="text-xs bg-gray-200 text-gray-700 px-1 py-0.5 rounded">
            AI
          </span>
        </span>
        <button className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
      </div>

      {/* Profile */}
      <div className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-xl">
        <img
          src="https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
          alt="Profile"
          className="h-10 w-10 rounded-full object-cover"
        />
        <div>
          <p className="font-medium text-gray-900">Shreyansh Kumar</p>
          <p className="text-gray-500 text-xs">shreyanshkumar1403@gmail.com</p>
        </div>
      </div>
      <button
        onClick={handleScan}
        className="cursor-pointer w-full bg-blue-600 text-white py-2 px-4 rounded-lg mb-2"
      >
        Find Relevant Posts
      </button>

      {/* Test button for demo */}
      <button
        onClick={handleShowTestPosts}
        className="cursor-pointer w-full bg-green-600 text-white py-2 px-4 rounded-lg text-sm"
      >
        Show Test Posts (Demo)
      </button>
      {/* Scanning */}
      <div className="mt-4">
        <p className="text-gray-800 font-medium">
          Scanning your network for opportunities…
        </p>
        <p className="text-gray-500 text-xs mt-1">
          Contacts and opportunities will be shared with you in . We’ll never
          post or contact your network without permission.
        </p>
      </div>

      {/* Connections */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-blue-600"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 0h-14c-2.762 0-5 2.238-5 5v14c0 2.762 2.238 5 5 5h14c2.762 0 5-2.238 5-5v-14c0-2.762-2.238-5-5-5zm-11 19h-3v-9h3v9zm-1.5-10.271c-.966 0-1.75-.791-1.75-1.764s.784-1.764 1.75-1.764 1.75.791 1.75 1.764-.784 1.764-1.75 1.764zm13.5 10.271h-3v-4.604c0-1.099-.021-2.514-1.533-2.514-1.536 0-1.771 1.2-1.771 2.437v4.681h-3v-9h2.881v1.23h.041c.401-.761 1.379-1.563 2.837-1.563 3.034 0 3.595 1.997 3.595 4.592v4.741z" />
            </svg>
            <span className="text-gray-800">LinkedIn</span>
          </div>
          <button
            className={`${
              linkedinConnected
                ? "bg-green-500 text-white"
                : "text-gray-600 hover:text-gray-800 border border-gray-300"
            } rounded-full px-3 py-2 text-sm cursor-pointer`}
            onClick={handleLinkedInConnect}
            disabled={linkedinConnected || checking}
          >
            {linkedinConnected
              ? "Connected"
              : checking
              ? "Checking..."
              : "Connect"}
          </button>
        </div>

        <div className="items-center justify-between hidden">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-gray-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M22.46 6c-.77.35-1.6.58-2.46.69a4.27 4.27 0 001.88-2.36 8.57 8.57 0 01-2.71 1.04A4.26 4.26 0 0016.1 4c-2.36 0-4.28 1.9-4.28 4.25 0 .33.04.66.1.97-3.56-.17-6.72-1.86-8.84-4.41-.37.63-.58 1.36-.58 2.15 0 1.48.76 2.79 1.91 3.56a4.28 4.28 0 01-1.94-.54v.05c0 2.07 1.48 3.8 3.44 4.19-.36.1-.75.16-1.14.16-.28 0-.55-.03-.81-.08.55 1.71 2.16 2.95 4.06 2.99A8.53 8.53 0 012 19.54a12 12 0 006.29 1.84c7.55 0 11.68-6.18 11.68-11.54 0-.18 0-.35-.01-.53.8-.57 1.5-1.3 2.05-2.12z" />
            </svg>
            <span className="text-gray-800">X disconnected</span>
          </div>
          <button className="bg-gray-900 hover:bg-gray-800 text-white rounded px-3 py-0.5 text-sm">
            Connect
          </button>
        </div>
      </div>

      {/* Support */}
      <div className="mt-4">
        <a href="#" className="text-blue-500 text-sm hover:underline">
          Support guide
        </a>
      </div>
    </div>
  );
}
