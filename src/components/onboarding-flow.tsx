/**
 * @file components/onboarding-flow.tsx
 * Renders the full onboarding experience:
 *   1. "check"         → brief loading screen
 *   2. "pick-provider" → provider/model selection
 *   3. "enter-key"     → API key input
 *
 * This component has NO business logic — it only renders.
 * All state and transitions come from the useOnboarding() hook.
 */

import { Box, Text } from "ink";
import React from "react";
import ModelOverlay from "./model-overlay.js";
import ApiKeyInput from "./api-key-input.js";
import type {
  OnboardingStage,
  ModelProvider,
  AppConfig,
  PendingSwitch,
} from "../types.js";

interface OnboardingFlowProps {
  stage: OnboardingStage;
  config: AppConfig;
  pending: PendingSwitch | null;
  onProviderSelect: (provider: ModelProvider, model: string) => void;
  onKeySubmit: (key: string) => void;
  onKeyBack: () => void;
}

/** A shared header shown at the top of every onboarding screen. */
function OnboardingHeader(): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1} marginBottom={1}>
      <Text bold color="cyan">
        🌐 Welcome to Browser Agent!
      </Text>
    </Box>
  );
}

export default function OnboardingFlow({
  stage,
  config,
  pending,
  onProviderSelect,
  onKeySubmit,
  onKeyBack,
}: OnboardingFlowProps): React.ReactElement {
  // ── Stage: checking ──────────────────────────────────────────────
  if (stage === "check") {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>Checking configuration...</Text>
      </Box>
    );
  }

  // ── Stage: pick provider ─────────────────────────────────────────
  if (stage === "pick-provider") {
    return (
      <Box flexDirection="column">
        <OnboardingHeader />
        <Text dimColor>
          Let&apos;s get you set up. Choose a model provider to get started.
        </Text>
        <ModelOverlay
          currentProvider={config.provider}
          currentModel={config.model}
          onSelect={onProviderSelect}
          onExit={() => {
            // Cannot exit during onboarding — must pick a provider
          }}
        />
      </Box>
    );
  }

  // ── Stage: enter API key ─────────────────────────────────────────
  if (stage === "enter-key" && pending) {
    return (
      <Box flexDirection="column">
        <OnboardingHeader />
        <Text dimColor>
          Enter your API key for{" "}
          <Text color={pending.provider.color} bold>
            {pending.provider.name}
          </Text>{" "}
          to continue.
        </Text>
        <ApiKeyInput
          providerName={pending.provider.name}
          envKeyName={pending.provider.envKey}
          existingKey={config.apiKeys[pending.provider.envKey]}
          keyHint={pending.provider.keyHint}
          onSubmit={onKeySubmit}
          onSkip={onKeyBack}
          skipLabel="← Back to provider selection"
        />
      </Box>
    );
  }

  // Fallback (should never render — "done" is handled by App)
  return <Box />;
}
