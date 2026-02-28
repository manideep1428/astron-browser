import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { Header } from "./components/Header";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { OutputArea } from "./components/OutputArea";
import { InputBar } from "./components/InputBar";
import "./index.css";

const WS_URL = `ws://${window.location.hostname || "localhost"}:8765/ws`;

function App() {
  const { status, messages, isConnected, isTaskRunning, sendTask, connect } =
    useWebSocket(WS_URL);

  const [hasStarted, setHasStarted] = useState(false);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);

  // Track thinking time
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTaskRunning) {
      setThinkingSeconds(0);
      interval = setInterval(() => {
        setThinkingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setThinkingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isTaskRunning]);

  const handleSubmit = useCallback(
    (prompt: string) => {
      setHasStarted(true);
      sendTask(prompt);
    },
    [sendTask],
  );

  const handleSuggestion = useCallback(
    (prompt: string) => {
      if (status === "ready") {
        handleSubmit(prompt);
      }
    },
    [status, handleSubmit],
  );

  const isInputDisabled =
    !isConnected || isTaskRunning || status === "disconnected";
  const showWelcome =
    !hasStarted && messages.filter((m) => m.type !== "system").length === 0;

  return (
    <div className="app">
      <Header status={status} isConnected={isConnected} />

      <div className="session-panel">
        <div className="session-info">
          <span className="icon">↳</span>
          <span className="label">session:</span>
          <span className="value">{crypto.randomUUID().slice(0, 8)}</span>
        </div>
        <div className="session-info">
          <span className="icon">↳</span>
          <span className="label">agent:</span>
          <span className="value">browser-use / ChatBrowserUse</span>
        </div>
        <div className="session-info">
          <span className="icon">↳</span>
          <span className="label">python:</span>
          <span className="value">daemon.py</span>
        </div>
      </div>

      {!isConnected && (
        <div className="connection-banner">
          <span>⚠</span>
          <span>
            Not connected to server — make sure <code>bun server.ts</code> is
            running on port 8765
          </span>
          <button onClick={() => connect()}>Retry</button>
        </div>
      )}

      {showWelcome ? (
        <WelcomeScreen onSuggestionClick={handleSuggestion} />
      ) : (
        <OutputArea
          messages={messages}
          isTaskRunning={isTaskRunning}
          thinkingSeconds={thinkingSeconds}
        />
      )}

      <InputBar
        onSubmit={handleSubmit}
        disabled={isInputDisabled}
        placeholder={
          status === "starting"
            ? "Daemon is starting... please wait"
            : status === "running"
              ? "Agent is working on a task..."
              : "What should the browser do?"
        }
      />
    </div>
  );
}

export default App;
