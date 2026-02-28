import React, { useEffect, useRef } from "react";

interface OutputMessage {
  type: string;
  text: string;
  timestamp: number;
}

interface OutputAreaProps {
  messages: OutputMessage[];
  isTaskRunning: boolean;
  thinkingSeconds: number;
}

function getLineClass(type: string): string {
  switch (type) {
    case "system":
      return "system";
    case "error":
      return "error";
    case "done":
      return "success";
    case "user":
      return "user-input";
    case "task-header":
      return "task-header";
    default:
      return "agent-output";
  }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export const OutputArea: React.FC<OutputAreaProps> = ({
  messages,
  isTaskRunning,
  thinkingSeconds,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTaskRunning]);

  const formatSeconds = (s: number): string => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
  };

  return (
    <div className="output-area">
      {messages.map((msg, i) => {
        // Parse output that contains task markers
        const text = msg.text;
        const isTaskLine = text.startsWith("\n> Task:");
        const lineClass = isTaskLine ? "task-header" : getLineClass(msg.type);
        const displayText = isTaskLine
          ? text.replace("\n> Task: ", "▶ ")
          : text;

        return (
          <div key={i} className={`output-line ${lineClass}`}>
            {msg.type === "done" ? (
              <div className="task-done">
                <span>✔</span>
                <span>Task completed successfully</span>
                <span
                  style={{ marginLeft: "auto", opacity: 0.5, fontSize: 11 }}
                >
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
            ) : (
              <>
                <span
                  style={{
                    color: "var(--text-muted)",
                    marginRight: 8,
                    fontSize: 11,
                  }}
                >
                  {formatTimestamp(msg.timestamp)}
                </span>
                {displayText}
              </>
            )}
          </div>
        );
      })}

      {isTaskRunning && (
        <div className="thinking-indicator">
          <div className="thinking-dots">
            <div className="thinking-dot" />
            <div className="thinking-dot" />
            <div className="thinking-dot" />
          </div>
          <span className="thinking-text">Agent is working...</span>
          <span className="thinking-timer">
            {formatSeconds(thinkingSeconds)}
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
