import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import React, { useState, useCallback, Fragment } from "react";
import ThinkingSpinner from "./thinking-spinner.js";

const suggestions = [
  'Go to google.com and search for "browser-use"',
  "Find the star count of browser-use repo on GitHub",
  "Go to Hacker News and find the top story",
];

const slashCommands = [
  { cmd: "model", desc: "Opens a dialog to configure the model" },
  { cmd: "keys", desc: "Manage saved API keys (edit, delete)" },
  { cmd: "config", desc: "Show current configuration" },
  { cmd: "help", desc: "Show help & keyboard shortcuts" },
  { cmd: "clear", desc: "Clear the screen and conversation history" },
  { cmd: "quit", desc: "Exit the application" },
];

interface ChatInputProps {
  isNew: boolean;
  loading: boolean;
  onSubmit: (prompt: string) => void;
  onInterrupt: () => void;
  onSlashCommand: (cmd: string) => void;
  active: boolean;
  statusLine?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  isNew,
  loading,
  onSubmit,
  onInterrupt,
  onSlashCommand,
  active,
  statusLine,
}) => {
  const app = useApp();
  const [input, setInput] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draftInput, setDraftInput] = useState("");
  // Index of highlighted command in slash dropdown (-1 = none selected)
  const [slashIndex, setSlashIndex] = useState(-1);

  // Filter slash commands when input starts with "/"
  const isSlashMode = input.startsWith("/") && !loading;
  const typedCmd = isSlashMode ? input.slice(1).toLowerCase() : "";
  const matchingCommands = isSlashMode
    ? slashCommands.filter((c) => c.cmd.startsWith(typedCmd))
    : [];

  // Clamp slashIndex if matching list shrinks
  const clampedSlashIndex =
    matchingCommands.length === 0
      ? -1
      : slashIndex >= matchingCommands.length
        ? matchingCommands.length - 1
        : slashIndex;

  useInput(
    (_input, _key) => {
      if (!loading) {
        // ── Slash-mode arrow navigation ──────────────────────────
        if (isSlashMode && matchingCommands.length > 0) {
          if (_key.downArrow) {
            setSlashIndex((prev) => {
              const next = prev + 1;
              return next >= matchingCommands.length ? 0 : next;
            });
            return;
          }
          if (_key.upArrow) {
            setSlashIndex((prev) => {
              const next = prev - 1;
              return next < 0 ? matchingCommands.length - 1 : next;
            });
            return;
          }
          // Escape: close slash menu
          if (_key.escape) {
            setInput("");
            setSlashIndex(-1);
            return;
          }
          // Tab: autocomplete if single match
          if (_key.tab && matchingCommands.length === 1) {
            setInput("/" + matchingCommands[0]!.cmd);
            setSlashIndex(0);
            return;
          }
          return; // consume all other keys normally in slash mode
        }

        // ── History navigation (only when NOT in slash mode) ─────
        if (_key.upArrow && history.length > 0) {
          if (historyIndex == null) {
            setDraftInput(input);
          }
          const newIndex =
            historyIndex == null
              ? history.length - 1
              : Math.max(0, historyIndex - 1);
          setHistoryIndex(newIndex);
          setInput(history[newIndex] ?? "");
          return;
        }

        if (_key.downArrow && historyIndex != null) {
          const newIndex = historyIndex + 1;
          if (newIndex >= history.length) {
            setHistoryIndex(null);
            setInput(draftInput);
          } else {
            setHistoryIndex(newIndex);
            setInput(history[newIndex] ?? "");
          }
          return;
        }

        // Tab: cycle suggestions when empty
        if (_key.tab) {
          if (input.trim() === "" && isNew) {
            setSelectedSuggestion(
              (s) => (s + (_key.shift ? -1 : 1)) % (suggestions.length + 1),
            );
          }
          return;
        }

        // Enter on suggestion
        if (input.trim() === "" && isNew && selectedSuggestion && _key.return) {
          const suggestion = suggestions[selectedSuggestion - 1] || "";
          handleSubmit(suggestion);
          return;
        }
      }

      // Exit
      if (_input === "\u0003" || (_input === "c" && _key.ctrl)) {
        setTimeout(() => {
          app.exit();
          process.exit(0);
        }, 60);
      }

      // Interrupt with Escape
      if (_key.escape && loading) {
        onInterrupt();
      }
    },
    { isActive: active },
  );

  const handleSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      // Exit commands
      if (
        trimmed === "q" ||
        trimmed === ":q" ||
        trimmed === "exit" ||
        trimmed === "quit"
      ) {
        setTimeout(() => {
          app.exit();
          process.exit(0);
        }, 60);
        return;
      }

      // Slash commands
      if (trimmed.startsWith("/")) {
        let commandToRun = trimmed;
        const typedCmd = trimmed.slice(1).toLowerCase();
        const matches = slashCommands.filter((c) => c.cmd.startsWith(typedCmd));

        if (matches.length > 0) {
          const clampedIndex =
            slashIndex >= matches.length
              ? matches.length - 1
              : slashIndex < 0
                ? 0 // Autoselect first if nothing explicitly selected
                : slashIndex;
          const selected = matches[clampedIndex];
          if (selected) {
            commandToRun = "/" + selected.cmd;
          }
        }

        setInput("");
        setSlashIndex(-1);
        onSlashCommand(commandToRun);
        return;
      }

      onSubmit(trimmed);
      setHistory((prev) =>
        prev[prev.length - 1] === value ? prev : [...prev, value],
      );
      setHistoryIndex(null);
      setDraftInput("");
      setSelectedSuggestion(0);
      setInput("");
    },
    [app, onSubmit, onSlashCommand, slashIndex],
  );

  // Calculate max command width for alignment
  const maxCmdLen = Math.max(...slashCommands.map((c) => c.cmd.length));

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Input box */}
      <Box paddingX={1} marginBottom={1}>
        {loading ? (
          <Box paddingX={1}>
            <ThinkingSpinner active={loading} />
          </Box>
        ) : (
          <Box paddingX={1} gap={1}>
            <Text color="cyan" bold>
              ❯
            </Text>
            <TextInput
              focus={active}
              placeholder={
                selectedSuggestion
                  ? `"${suggestions[selectedSuggestion - 1]}"`
                  : "tell the browser what to do" +
                    (isNew ? " (type / for commands)" : "")
              }
              showCursor
              value={input}
              onChange={(value) => {
                if (historyIndex != null) {
                  setHistoryIndex(null);
                }
                setSelectedSuggestion(0);
                // Reset slash selection when typing changes the filter
                setSlashIndex(value.startsWith("/") ? 0 : -1);
                setInput(value);
              }}
              onSubmit={handleSubmit}
            />
          </Box>
        )}
      </Box>

      {/* Slash command dropdown */}
      {isSlashMode && matchingCommands.length > 0 && (
        <Box flexDirection="column" paddingX={2} marginBottom={1}>
          {matchingCommands.map((c, idx) => {
            const isHighlighted = idx === clampedSlashIndex;
            return (
              <Box key={c.cmd} gap={2}>
                <Text
                  color={isHighlighted ? "green" : "white"}
                  bold={isHighlighted}
                >
                  {("/" + c.cmd).padEnd(maxCmdLen + 1)}
                </Text>
                <Text
                  color={isHighlighted ? "green" : "gray"}
                  bold={isHighlighted}
                >
                  {c.desc}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Bottom hints */}
      {!isSlashMode && (
        <Box paddingX={2} flexDirection="column">
          {isNew && !input ? (
            <Text dimColor>
              try:{" "}
              {suggestions.map((m, key) => (
                <Fragment key={key}>
                  {key !== 0 ? " | " : ""}
                  <Text
                    backgroundColor={
                      key + 1 === selectedSuggestion ? "blackBright" : ""
                    }
                  >
                    {m}
                  </Text>
                </Fragment>
              ))}
            </Text>
          ) : (
            <Text dimColor>
              type / for commands | q to exit | esc to interrupt
            </Text>
          )}
        </Box>
      )}

      {/* Status line */}
      {statusLine && (
        <Box paddingX={2} marginBottom={1}>
          <Text dimColor>{statusLine}</Text>
        </Box>
      )}
    </Box>
  );
};

export default ChatInput;
