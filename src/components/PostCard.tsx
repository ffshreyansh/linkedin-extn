import React from "react";

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

interface PostCardProps {
  post: LinkedInPost;
  onOpenPost: (url: string) => void;
}

export default function PostCard({ post, onOpenPost }: PostCardProps) {
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInHours = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60)
      );

      if (diffInHours < 1) return "Just now";
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
      return date.toLocaleDateString();
    } catch {
      return "Unknown";
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 hover:shadow-md transition-shadow">
      {/* Author Info */}
      <div className="flex items-center gap-3 mb-3">
        <img
          src={
            post.author.imageUrl ||
            "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
          }
          alt={post.author.name}
          className="h-10 w-10 rounded-full object-cover"
          onError={(e) => {
            e.currentTarget.src =
              "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
          }}
        />
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 text-sm">
            {post.author.name}
          </h3>
          {post.author.title && (
            <p className="text-xs text-gray-600">{post.author.title}</p>
          )}
          <p className="text-xs text-gray-500">
            {formatTimestamp(post.timestamp)}
          </p>
        </div>
      </div>

      {/* Post Content */}
      <div className="mb-3">
        <p className="text-sm text-gray-800 leading-relaxed">
          {post.snippet}
          {post.content.length > 200 && (
            <span
              className="text-blue-600 cursor-pointer ml-1"
              onClick={() => onOpenPost(post.postUrl)}
            >
              ...see more
            </span>
          )}
        </p>
      </div>

      {/* Matched Keywords */}
      {post.matchedKeywords.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-1">Matched Skills:</p>
          <div className="flex flex-wrap gap-1">
            {post.matchedKeywords.map((keyword, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Engagement Stats */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clipRule="evenodd"
              />
            </svg>
            {formatNumber(post.likes)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                clipRule="evenodd"
              />
            </svg>
            {formatNumber(post.comments)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
            {formatNumber(post.shares)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onOpenPost(post.postUrl)}
          className="flex-1 bg-blue-600 text-white text-xs py-2 px-3 rounded-md hover:bg-blue-700 transition-colors"
        >
          View Post
        </button>
        {post.author.profileUrl && (
          <button
            onClick={() => onOpenPost(post.author.profileUrl)}
            className="bg-gray-100 text-gray-700 text-xs py-2 px-3 rounded-md hover:bg-gray-200 transition-colors"
          >
            View Profile
          </button>
        )}
      </div>
    </div>
  );
}
