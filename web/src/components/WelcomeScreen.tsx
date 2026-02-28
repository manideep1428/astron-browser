import React from "react";

interface WelcomeScreenProps {
  onSuggestionClick: (prompt: string) => void;
}

const suggestions = [
  {
    icon: "🔍",
    text: 'Go to google.com and search for "browser-use"',
  },
  {
    icon: "⭐",
    text: "Find the star count of browser-use repo on GitHub",
  },
  {
    icon: "📰",
    text: "Go to Hacker News and find the top story",
  },
  {
    icon: "🛒",
    text: 'Search Amazon for "mechanical keyboard" under $50',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSuggestionClick,
}) => {
  return (
    <div className="welcome">
      <div className="welcome-icon">🌐</div>
      <h2>Browser Agent</h2>
      <p>
        Tell the AI what to do in the browser. It will launch a real browser,
        navigate pages, click elements, and complete tasks autonomously.
      </p>

      <div className="welcome-hints">
        {suggestions.map((s, i) => (
          <button
            key={i}
            className="welcome-hint"
            onClick={() => onSuggestionClick(s.text)}
          >
            <span className="hint-icon">{s.icon}</span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
