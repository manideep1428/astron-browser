/**
 * @file app.tsx
 * Root application component for the Astron CLI.
 *
 * Responsibilities:
 *   - Orchestrates onboarding → daemon startup → chat loop
 *   - Handles slash commands (/model, /help, /keys, /clear, /config, /quit)
 *   - Manages the overlay panel state
 *
 * All heavy logic lives in dedicated hooks and components:
 *   - useOnboarding()    → src/hooks/use-onboarding.ts
 *   - useDaemon()        → src/hooks/use-daemon.ts
 *   - useMessages()      → src/hooks/use-messages.ts
 *   - <OnboardingFlow>   → src/components/onboarding-flow.tsx
 *   - <OverlayManager>   → src/components/overlay-manager.tsx
 */

import { Box } from "ink";
import React, { useState, useCallback, useEffect, useRef } from "react";
import MessageHistory from "./components/message-history.js";
import ChatInput from "./components/chat-input.js";
import OnboardingFlow from "./components/onboarding-flow.js";
import OverlayManager from "./components/overlay-manager.js";
import { useMessages } from "./hooks/use-messages.js";
import { useOnboarding } from "./hooks/use-onboarding.js";
import { useDaemon } from "./hooks/use-daemon.js";
import {
  saveConfig,
  syncEnvFile,
  deleteApiKey,
  getProvider,
  getActiveProvider,
  getConfigPath,
} from "./config.js";
import { VERSION } from "./constants.js";
import type {
  AppProps,
  AppConfig,
  ModelProvider,
  OverlayMode,
  PendingSwitch,
} from "./types.js";

export default function App({ prompt, mode }: AppProps): React.ReactElement {
  // ── Core hooks ───────────────────────────────────────────────────
  const { messages, addMessage, clearMessages } = useMessages();
  const {
    stage,
    config,
    setConfig,
    pending: onboardingPending,
    onProviderSelect,
    onKeySubmit,
    onKeyBack,
  } = useOnboarding();
  const { isReady, startDaemon, stopDaemon, sendTask } = useDaemon(addMessage);

  // ── Overlay state ────────────────────────────────────────────────
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("none");
  const [overlayPending, setOverlayPending] = useState<PendingSwitch | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const [sessionId] = useState(() =>
    Math.random().toString(36).substring(2, 10),
  );
  const daemonStarted = useRef(false);

  // ── Start daemon once onboarding completes ───────────────────────
  useEffect(() => {
    if (stage === "done" && !daemonStarted.current) {
      daemonStarted.current = true;
      const provider = getActiveProvider(config);
      addMessage(
        "system",
        `Using ${provider.name} (${config.model}) — starting browser...`,
      );
      startDaemon(config);
    }
    return () => {
      if (stage === "done") stopDaemon();
    };
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle initial one-shot prompt ──────────────────────────────
  const initialPromptSent = useRef(false);
  useEffect(() => {
    if (prompt && isReady && !initialPromptSent.current) {
      initialPromptSent.current = true;
      handleSubmit(prompt);
    }
  }, [prompt, isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit a task ────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (taskPrompt: string) => {
      addMessage("user", taskPrompt);
      setLoading(true);
      sendTask(taskPrompt);
      // Loading gets reset when daemon emits __DONE__
    },
    [addMessage, sendTask],
  );

  // ── Interrupt ────────────────────────────────────────────────────
  const handleInterrupt = useCallback(() => {
    setLoading(false);
    addMessage("system", "Task interrupted by user");
  }, [addMessage]);

  // ── Slash commands ───────────────────────────────────────────────
  const handleSlashCommand = useCallback(
    (cmd: string) => {
      const n = cmd.toLowerCase().trim();
      switch (n) {
        case "/model":
          setOverlayMode("model");
          break;
        case "/help":
          setOverlayMode("help");
          break;
        case "/keys":
          setOverlayMode("keys");
          break;
        case "/clear":
          clearMessages();
          addMessage("system", "Conversation cleared");
          break;
        case "/config": {
          const prov = getProvider(config.provider);
          const keyStatus = config.apiKeys[prov?.envKey ?? ""]
            ? "✓ set"
            : "✗ not set";
          addMessage(
            "system",
            `Provider: ${prov?.name ?? config.provider} | Model: ${config.model} | Key: ${keyStatus}\n  Config: ${getConfigPath()}`,
          );
          break;
        }
        case "/quit":
          process.exit(0);
          break;
        default:
          addMessage("error", `Unknown command: ${cmd}`);
      }
    },
    [config, addMessage, clearMessages],
  );

  // ── Model switch (post-onboarding) ───────────────────────────────
  const applyModelSwitch = useCallback(
    (provider: ModelProvider, model: string, cfg: AppConfig) => {
      const newConfig: AppConfig = { ...cfg, provider: provider.id, model };
      setConfig(newConfig);
      saveConfig(newConfig);
      syncEnvFile(newConfig);
      setOverlayMode("none");
      setOverlayPending(null);
      addMessage("system", `✓ Switched to ${provider.name} — ${model}`);
      addMessage("system", "Restarting browser with new model...");
      startDaemon(newConfig);
    },
    [addMessage, setConfig, startDaemon],
  );

  const handleModelSelect = useCallback(
    (provider: ModelProvider, model: string) => {
      if (config.apiKeys[provider.envKey]) {
        applyModelSwitch(provider, model, config);
      } else {
        setOverlayPending({ provider, model });
        setOverlayMode("apikey");
      }
    },
    [config, applyModelSwitch],
  );

  const handleApiKeySubmit = useCallback(
    (key: string) => {
      if (!overlayPending) return;
      const newConfig: AppConfig = {
        ...config,
        apiKeys: { ...config.apiKeys, [overlayPending.provider.envKey]: key },
      };
      setConfig(newConfig);
      applyModelSwitch(
        overlayPending.provider,
        overlayPending.model,
        newConfig,
      );
    },
    [config, overlayPending, setConfig, applyModelSwitch],
  );

  const handleApiKeySkip = useCallback(() => {
    if (!overlayPending) {
      setOverlayMode("none");
      return;
    }
    applyModelSwitch(overlayPending.provider, overlayPending.model, config);
  }, [config, overlayPending, applyModelSwitch]);

  // ── Key management ───────────────────────────────────────────────
  const handleKeyDelete = useCallback(
    (envKey: string) => {
      const newConfig = deleteApiKey(config, envKey);
      setConfig(newConfig);
      syncEnvFile(newConfig);
      addMessage("system", `Deleted key for ${envKey}`);
    },
    [config, setConfig, addMessage],
  );

  const handleKeyEdit = useCallback(
    (providerId: string) => {
      const provider = getProvider(providerId);
      if (provider) {
        setOverlayPending({ provider, model: config.model });
        setOverlayMode("keys-edit");
      }
    },
    [config],
  );

  const handleKeysEditSubmit = useCallback(
    (key: string) => {
      if (!overlayPending) return;
      const newConfig: AppConfig = {
        ...config,
        apiKeys: { ...config.apiKeys, [overlayPending.provider.envKey]: key },
      };
      setConfig(newConfig);
      saveConfig(newConfig);
      syncEnvFile(newConfig);
      setOverlayMode("keys");
      setOverlayPending(null);
      addMessage("system", `✓ Updated key for ${overlayPending.provider.name}`);
    },
    [config, overlayPending, setConfig, addMessage],
  );

  const handleKeysEditBack = useCallback(() => {
    setOverlayMode("keys");
    setOverlayPending(null);
  }, []);

  // ── Status line for ChatInput ────────────────────────────────────
  const provider = getProvider(config.provider);
  const statusLine = `${provider?.name ?? config.provider} (${config.model})`;

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  // Show onboarding screens until setup is complete
  if (stage !== "done") {
    return (
      <OnboardingFlow
        stage={stage}
        config={config}
        pending={onboardingPending}
        onProviderSelect={onProviderSelect}
        onKeySubmit={onKeySubmit}
        onKeyBack={onKeyBack}
      />
    );
  }

  // Normal chat UI
  return (
    <Box flexDirection="column">
      <MessageHistory
        messages={messages}
        headerProps={{ version: VERSION, model: config.model, mode, sessionId }}
      />

      <OverlayManager
        mode={overlayMode}
        config={config}
        pending={overlayPending}
        onClose={() => setOverlayMode("none")}
        onModelSelect={handleModelSelect}
        onApiKeySubmit={handleApiKeySubmit}
        onApiKeySkip={handleApiKeySkip}
        onKeyDelete={handleKeyDelete}
        onKeyEdit={handleKeyEdit}
        onKeysEditSubmit={handleKeysEditSubmit}
        onKeysEditBack={handleKeysEditBack}
      />

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
