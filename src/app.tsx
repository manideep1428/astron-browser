import { Box, Text } from "ink";
import React, { useState, useCallback, useEffect, useRef } from "react";
import MessageHistory, {
  type OutputMessage,
} from "./components/message-history.js";
import ChatInput from "./components/chat-input.js";
import ModelOverlay from "./components/model-overlay.js";
import HelpOverlay from "./components/help-overlay.js";
import ApiKeyInput from "./components/api-key-input.js";
import KeysOverlay from "./components/keys-overlay.js";
import {
  loadConfig,
  saveConfig,
  syncEnvFile,
  deleteApiKey,
  getProvider,
  getActiveProvider,
  hasActiveApiKey,
  getConfigPath,
  PROVIDERS,
  type AppConfig,
  type ModelProvider,
} from "./config.js";

const VERSION = "0.1.0";

// ── Stderr noise filter ──────────────────────────────────────────
const STDERR_NOISE_PATTERNS = [
  /^\s*INFO\s/,
  /\[BrowserSession\]/,
  /\[SessionManager\]/,
  /\[Browser\]/,
  /\[Agent\]/,
  /\[Controller\]/,
  /\[DOMService\]/,
  /\[NavigationHandler\]/,
  /^\s*DEBUG\s/,
  /^\s*WARNING\s/,
];

function isStderrNoise(line: string): boolean {
  return STDERR_NOISE_PATTERNS.some((p) => p.test(line));
}

interface AppProps {
  prompt?: string;
  mode: "daemon" | "one-shot";
}

/**
 * Onboarding stages:
 *   "check"    → initial check (auto-transitions)
 *   "pick-provider" → user must pick a provider + model
 *   "enter-key"     → user must enter API key for chosen provider
 *   "done"          → onboarding complete, daemon runs
 */
type OnboardingStage = "check" | "pick-provider" | "enter-key" | "done";

type OverlayMode = "none" | "model" | "help" | "apikey" | "keys" | "keys-edit";

export default function App({ prompt, mode }: AppProps): React.ReactElement {
  const [config, setConfig] = useState<AppConfig>(() => loadConfig());
  const [messages, setMessages] = useState<OutputMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("none");
  const [pendingProvider, setPendingProvider] = useState<ModelProvider | null>(
    null,
  );
  const [pendingModel, setPendingModel] = useState<string>("");

  // ── Onboarding state ──────────────────────────────────────────
  const [onboarding, setOnboarding] = useState<OnboardingStage>("check");

  const daemonRef = useRef<ReturnType<typeof Bun.spawn> | null>(null);
  const [sessionId] = useState(() =>
    Math.random().toString(36).substring(2, 10),
  );
  const isReadyRef = useRef(false);
  const isTaskRunningRef = useRef(false);
  const msgCounter = useRef(0);

  const addMessage = useCallback(
    (type: OutputMessage["type"], text: string) => {
      msgCounter.current += 1;
      const uid = Math.random().toString(36).substring(2, 10);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${msgCounter.current}-${uid}`,
          type,
          text,
          timestamp: Date.now(),
        },
      ]);
    },
    [],
  );

  // ── Onboarding: check on mount ─────────────────────────────────
  useEffect(() => {
    if (onboarding !== "check") return;

    const cfg = loadConfig();
    setConfig(cfg);
    const activeProvider = getActiveProvider(cfg);

    if (cfg.apiKeys[activeProvider.envKey]) {
      // Key exists for current provider → skip onboarding
      setOnboarding("done");
    } else {
      // No key → force provider selection
      setOnboarding("pick-provider");
    }
  }, [onboarding]);

  // ── Onboarding: handle provider+model selected ─────────────────
  const handleOnboardingModelSelect = useCallback(
    (provider: ModelProvider, model: string) => {
      setPendingProvider(provider);
      setPendingModel(model);
      setOnboarding("enter-key");
    },
    [],
  );

  // ── Onboarding: handle API key submitted ───────────────────────
  const handleOnboardingKeySubmit = useCallback(
    (key: string) => {
      if (!pendingProvider) return;
      const newConfig: AppConfig = {
        ...config,
        provider: pendingProvider.id,
        model: pendingModel,
        apiKeys: { ...config.apiKeys, [pendingProvider.envKey]: key },
      };
      setConfig(newConfig);
      saveConfig(newConfig);
      syncEnvFile(newConfig);
      setPendingProvider(null);
      setPendingModel("");
      setOnboarding("done");
    },
    [config, pendingProvider, pendingModel],
  );

  // ── Onboarding: go back from key entry to provider selection ───
  const handleOnboardingKeyBack = useCallback(() => {
    setPendingProvider(null);
    setPendingModel("");
    setOnboarding("pick-provider");
  }, []);

  // ── Start daemon ONLY after onboarding is done ─────────────────

  // ── Stop daemon ────────────────────────────────────────────────
  const stopDaemon = useCallback(() => {
    const d = daemonRef.current;
    if (d) {
      const h = d.stdin as { end?: () => void };
      h?.end?.();
      daemonRef.current = null;
    }
    isReadyRef.current = false;
    setIsReady(false);
  }, []);

  // ── Start daemon ───────────────────────────────────────────────
  const startDaemon = useCallback(
    (cfg: AppConfig) => {
      // Stop existing daemon first
      stopDaemon();

      const { resolve } = require("path");
      const scriptDir = import.meta.dir;
      const projectRoot = resolve(scriptDir, "..");
      const pythonDir = resolve(projectRoot, "python");

      syncEnvFile(cfg);

      const daemon = Bun.spawn({
        cmd: [
          "uv",
          "run",
          "python",
          "-u",
          resolve(pythonDir, "daemon.py"),
          cfg.provider,
          cfg.model,
        ],
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        cwd: projectRoot,
      });

      daemonRef.current = daemon;

      const stdoutReader = daemon.stdout.getReader();
      const decoder = new TextDecoder();

      (async () => {
        while (true) {
          const { value, done } = await stdoutReader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const parts = chunk.split("__DONE__");

          for (let i = 0; i < parts.length; i++) {
            const text = parts[i] ?? "";
            const trimmed = text.trim();
            if (!isReadyRef.current && trimmed.includes("Browser started")) {
              isReadyRef.current = true;
              setIsReady(true);
            } else if (trimmed) {
              if (trimmed.startsWith("[error]")) {
                addMessage("error", trimmed.replace("[error]", "").trim());
              } else if (
                trimmed.startsWith("[daemon]") ||
                trimmed.startsWith("[system]")
              ) {
                addMessage(
                  "system",
                  trimmed.replace(/\[(daemon|system)\]/, "").trim(),
                );
              } else {
                addMessage("agent", trimmed);
              }
            }
            if (i < parts.length - 1) {
              isTaskRunningRef.current = false;
              setLoading(false);
              addMessage("done", "Task completed");
            }
          }
        }
        addMessage("system", "Browser daemon stopped");
      })();

      const stderrReader = daemon.stderr.getReader();
      const stderrDecoder = new TextDecoder();

      (async () => {
        while (true) {
          const { value, done } = await stderrReader.read();
          if (done) break;
          const chunk = stderrDecoder.decode(value);
          for (const line of chunk.split("\n")) {
            const trimmed = line.trim();
            if (trimmed && !isStderrNoise(trimmed)) {
              const isError = /error|exception|traceback/i.test(trimmed);
              addMessage(isError ? "error" : "agent", trimmed);
            }
          }
        }
      })();
    },
    [addMessage, stopDaemon],
  );

  // Start daemon only when onboarding completes
  const daemonStarted = useRef(false);
  useEffect(() => {
    if (onboarding === "done" && !daemonStarted.current) {
      daemonStarted.current = true;
      const provider = getActiveProvider(config);
      addMessage(
        "system",
        `Using ${provider.name} (${config.model}) — starting browser...`,
      );
      startDaemon(config);
    }
    return () => {
      if (onboarding !== "done") return;
      stopDaemon();
    };
  }, [onboarding]);

  // ── Handle initial prompt ──────────────────────────────────────
  const initialPromptSent = useRef(false);
  useEffect(() => {
    if (prompt && isReady && !initialPromptSent.current) {
      initialPromptSent.current = true;
      handleSubmit(prompt);
    }
  }, [prompt, isReady]);

  // ── Submit task ────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (taskPrompt: string) => {
      if (!daemonRef.current || !isReadyRef.current) {
        addMessage("error", "Daemon is not ready yet. Please wait...");
        return;
      }
      addMessage("user", taskPrompt);
      setLoading(true);
      isTaskRunningRef.current = true;
      const stdin = daemonRef.current.stdin as unknown as {
        write: (s: string) => void;
        flush: () => void;
      };
      stdin.write(taskPrompt + "\n");
      stdin.flush();
    },
    [addMessage],
  );

  // ── Interrupt ──────────────────────────────────────────────────
  const handleInterrupt = useCallback(() => {
    if (isTaskRunningRef.current) {
      isTaskRunningRef.current = false;
      setLoading(false);
      addMessage("system", "Task interrupted by user");
    }
  }, [addMessage]);

  // ── Slash commands ─────────────────────────────────────────────
  const handleSlashCommand = useCallback(
    (cmd: string) => {
      const n = cmd.toLowerCase().trim();
      if (n === "/model") {
        setOverlayMode("model");
      } else if (n === "/help") {
        setOverlayMode("help");
      } else if (n === "/keys") {
        setOverlayMode("keys");
      } else if (n === "/clear") {
        setMessages([]);
        addMessage("system", "Conversation cleared");
      } else if (n === "/config") {
        const prov = getProvider(config.provider);
        const keyStatus = config.apiKeys[prov?.envKey ?? ""]
          ? "✓ set"
          : "✗ not set";
        addMessage(
          "system",
          `Provider: ${prov?.name ?? config.provider} | Model: ${config.model} | Key: ${keyStatus}\n  Config: ${getConfigPath()}`,
        );
      } else if (n === "/quit") {
        process.exit(0);
      } else {
        addMessage("error", `Unknown command: ${cmd}`);
      }
    },
    [config, addMessage],
  );

  // ── Model selection → API key flow (post-onboarding) ───────────
  const finishModelSwitch = useCallback(
    (provider: ModelProvider, model: string, cfg: AppConfig) => {
      const newConfig: AppConfig = {
        ...cfg,
        provider: provider.id,
        model: model,
      };
      setConfig(newConfig);
      saveConfig(newConfig);
      syncEnvFile(newConfig);
      setOverlayMode("none");
      setPendingProvider(null);
      setPendingModel("");
      addMessage("system", `✓ Switched to ${provider.name} — ${model}`);

      // Restart daemon with new model so it takes effect immediately
      addMessage("system", "Restarting browser with new model...");
      daemonStarted.current = false;
      daemonStarted.current = true;
      startDaemon(newConfig);
    },
    [addMessage, startDaemon],
  );

  const handleModelSelect = useCallback(
    (provider: ModelProvider, model: string) => {
      if (config.apiKeys[provider.envKey]) {
        finishModelSwitch(provider, model, config);
      } else {
        setPendingProvider(provider);
        setPendingModel(model);
        setOverlayMode("apikey");
      }
    },
    [config, finishModelSwitch],
  );

  const handleApiKeySubmit = useCallback(
    (key: string) => {
      if (!pendingProvider) return;
      const newConfig: AppConfig = {
        ...config,
        apiKeys: { ...config.apiKeys, [pendingProvider.envKey]: key },
      };
      setConfig(newConfig);
      finishModelSwitch(pendingProvider, pendingModel, newConfig);
    },
    [config, pendingProvider, pendingModel, finishModelSwitch],
  );

  const handleApiKeySkip = useCallback(() => {
    if (!pendingProvider) {
      setOverlayMode("none");
      return;
    }
    finishModelSwitch(pendingProvider, pendingModel, config);
  }, [config, pendingProvider, pendingModel, finishModelSwitch]);

  // ── Key management ─────────────────────────────────────────────
  const handleKeyDelete = useCallback(
    (envKey: string) => {
      const newConfig = deleteApiKey(config, envKey);
      setConfig(newConfig);
      syncEnvFile(newConfig);
      addMessage("system", `Deleted key for ${envKey}`);
    },
    [config, addMessage],
  );

  const handleKeyEdit = useCallback(
    (providerId: string) => {
      const provider = getProvider(providerId);
      if (provider) {
        setPendingProvider(provider);
        setPendingModel(config.model);
        setOverlayMode("keys-edit");
      }
    },
    [config],
  );

  const handleKeysEditSubmit = useCallback(
    (key: string) => {
      if (!pendingProvider) return;
      const newConfig: AppConfig = {
        ...config,
        apiKeys: { ...config.apiKeys, [pendingProvider.envKey]: key },
      };
      setConfig(newConfig);
      saveConfig(newConfig);
      syncEnvFile(newConfig);
      setOverlayMode("keys");
      setPendingProvider(null);
      addMessage("system", `✓ Updated key for ${pendingProvider.name}`);
    },
    [config, pendingProvider, addMessage],
  );

  // ── Build status line ──────────────────────────────────────────
  const provider = getProvider(config.provider);
  const statusLine = `${provider?.name ?? config.provider} (${config.model})`;

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  // ── Onboarding: pick provider ──────────────────────────────────
  if (onboarding === "pick-provider") {
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" paddingX={1} paddingY={1} marginBottom={1}>
          <Text bold color="cyan">
            🌐 Welcome to Browser Agent!
          </Text>
          <Text dimColor>
            Let's get you set up. Choose a model provider to get started.
          </Text>
        </Box>
        <ModelOverlay
          currentProvider={config.provider}
          currentModel={config.model}
          onSelect={handleOnboardingModelSelect}
          onExit={() => {
            // Can't exit during onboarding — must pick a provider
          }}
        />
      </Box>
    );
  }

  // ── Onboarding: enter API key ──────────────────────────────────
  if (onboarding === "enter-key" && pendingProvider) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" paddingX={1} paddingY={1} marginBottom={1}>
          <Text bold color="cyan">
            🌐 Welcome to Browser Agent!
          </Text>
          <Text dimColor>
            Enter your API key for{" "}
            <Text color={pendingProvider.color} bold>
              {pendingProvider.name}
            </Text>{" "}
            to continue.
          </Text>
        </Box>
        <ApiKeyInput
          providerName={pendingProvider.name}
          envKeyName={pendingProvider.envKey}
          existingKey={config.apiKeys[pendingProvider.envKey]}
          keyHint={pendingProvider.keyHint}
          onSubmit={handleOnboardingKeySubmit}
          onSkip={handleOnboardingKeyBack}
          skipLabel="← Back to provider selection"
        />
      </Box>
    );
  }

  // ── Onboarding: checking (brief flash) ─────────────────────────
  if (onboarding === "check") {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>Checking configuration...</Text>
      </Box>
    );
  }

  // ── Normal app (post-onboarding) ───────────────────────────────
  return (
    <Box flexDirection="column">
      <MessageHistory
        messages={messages}
        headerProps={{
          version: VERSION,
          model: config.model,
          mode,
          sessionId,
        }}
      />

      {/* Model selection overlay */}
      {overlayMode === "model" && (
        <ModelOverlay
          currentProvider={config.provider}
          currentModel={config.model}
          onSelect={handleModelSelect}
          onExit={() => setOverlayMode("none")}
        />
      )}

      {/* Help overlay */}
      {overlayMode === "help" && (
        <HelpOverlay onExit={() => setOverlayMode("none")} />
      )}

      {/* API key input (from /model flow) */}
      {overlayMode === "apikey" && pendingProvider && (
        <ApiKeyInput
          providerName={pendingProvider.name}
          envKeyName={pendingProvider.envKey}
          existingKey={config.apiKeys[pendingProvider.envKey]}
          keyHint={pendingProvider.keyHint}
          onSubmit={handleApiKeySubmit}
          onSkip={handleApiKeySkip}
        />
      )}

      {/* Key management overlay */}
      {overlayMode === "keys" && (
        <KeysOverlay
          config={config}
          onDelete={handleKeyDelete}
          onEdit={handleKeyEdit}
          onExit={() => setOverlayMode("none")}
        />
      )}

      {/* API key input (from /keys edit flow) */}
      {overlayMode === "keys-edit" && pendingProvider && (
        <ApiKeyInput
          providerName={pendingProvider.name}
          envKeyName={pendingProvider.envKey}
          existingKey={config.apiKeys[pendingProvider.envKey]}
          keyHint={pendingProvider.keyHint}
          onSubmit={handleKeysEditSubmit}
          onSkip={() => {
            setOverlayMode("keys");
            setPendingProvider(null);
          }}
        />
      )}

      {/* Input — only show after onboarding is done */}
      {mode === "daemon" && (
        <ChatInput
          isNew={messages.filter((m) => m.type === "user").length === 0}
          loading={loading}
          onSubmit={handleSubmit}
          onInterrupt={handleInterrupt}
          onSlashCommand={handleSlashCommand}
          active={overlayMode === "none"}
          statusLine={statusLine}
        />
      )}
    </Box>
  );
}
