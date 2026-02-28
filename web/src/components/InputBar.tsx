import React, { useState, useRef, useEffect } from "react";

interface InputBarProps {
  onSubmit: (prompt: string) => void;
  disabled: boolean;
  placeholder?: string;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSubmit,
  disabled,
  placeholder = "What should the browser do?",
}) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  // Keep focus on input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus input on any letter key if not already focused
      if (
        document.activeElement !== inputRef.current &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        e.key.length === 1
      ) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="input-area">
      <div className={`input-container ${disabled ? "disabled" : ""}`}>
        <span className="input-prompt-symbol">❯</span>
        <input
          ref={inputRef}
          type="text"
          className="input-field"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Waiting for agent..." : placeholder}
          disabled={disabled}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="input-submit-btn"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          title="Submit (Enter)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      <div className="input-hint">
        <span className="input-hint-text">
          Type a task for the browser agent
        </span>
        <span className="input-hint-kbd">
          <kbd>Enter</kbd>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            to send
          </span>
        </span>
      </div>
    </div>
  );
};
