/**
 * @file types.ts
 * Shared TypeScript types used across the app.
 * Keep this file side-effect free — only type declarations.
 */

import type { ModelProvider, AppConfig } from "./config.js";

/** A single message in the conversation history. */
export interface OutputMessage {
    id: string;
    type: "user" | "agent" | "system" | "error" | "done";
    text: string;
    timestamp: number;
}

/** App-level props passed from cli.tsx → App. */
export interface AppProps {
    prompt?: string;
    mode: "daemon" | "one-shot";
}

/**
 * Onboarding finite-state machine stages:
 *  "check"         → initial check (auto-transitions)
 *  "pick-provider" → user must pick a provider + model
 *  "enter-key"     → user must enter API key for chosen provider
 *  "done"          → onboarding complete, daemon running
 */
export type OnboardingStage =
    | "check"
    | "pick-provider"
    | "enter-key"
    | "done";

/**
 * Which overlay panel is currently visible.
 * "none" means the normal chat view is active.
 */
export type OverlayMode =
    | "none"
    | "model"
    | "help"
    | "apikey"
    | "keys"
    | "keys-edit";

/** Pending provider + model while awaiting key entry. */
export interface PendingSwitch {
    provider: ModelProvider;
    model: string;
}

export type { AppConfig, ModelProvider };
