/**
 * @file hooks/use-onboarding.ts
 * Onboarding finite-state machine.
 *
 * Stages:
 *   "check"         → Reads config; auto-transitions to next stage
 *   "pick-provider" → User selects a provider + model
 *   "enter-key"     → User types their API key
 *   "done"          → Onboarding complete; main app renders
 *
 * Returns helpers to drive each stage transition.
 */

import { useState, useCallback, useEffect } from "react";
import {
    loadConfig,
    saveConfig,
    syncEnvFile,
    getActiveProvider,
} from "../config.js";
import type {
    AppConfig,
    ModelProvider,
    OnboardingStage,
    PendingSwitch,
} from "../types.js";

export interface UseOnboardingReturn {
    stage: OnboardingStage;
    config: AppConfig;
    setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
    pending: PendingSwitch | null;
    onProviderSelect: (provider: ModelProvider, model: string) => void;
    onKeySubmit: (key: string) => void;
    onKeyBack: () => void;
}

export function useOnboarding(): UseOnboardingReturn {
    const [config, setConfig] = useState<AppConfig>(() => loadConfig());
    const [stage, setStage] = useState<OnboardingStage>("check");
    const [pending, setPending] = useState<PendingSwitch | null>(null);

    // ── Stage: check ─────────────────────────────────────────────────
    useEffect(() => {
        if (stage !== "check") return;
        const cfg = loadConfig();
        setConfig(cfg);
        const activeProvider = getActiveProvider(cfg);
        if (cfg.apiKeys[activeProvider.envKey]) {
            setStage("done");
        } else {
            setStage("pick-provider");
        }
    }, [stage]);

    // ── Stage: pick-provider → enter-key ─────────────────────────────
    const onProviderSelect = useCallback(
        (provider: ModelProvider, model: string) => {
            setPending({ provider, model });
            setStage("enter-key");
        },
        [],
    );

    // ── Stage: enter-key → done ───────────────────────────────────────
    const onKeySubmit = useCallback(
        (key: string) => {
            if (!pending) return;
            const newConfig: AppConfig = {
                ...config,
                provider: pending.provider.id,
                model: pending.model,
                apiKeys: { ...config.apiKeys, [pending.provider.envKey]: key },
            };
            setConfig(newConfig);
            saveConfig(newConfig);
            syncEnvFile(newConfig);
            setPending(null);
            setStage("done");
        },
        [config, pending],
    );

    // ── Stage: enter-key → pick-provider (back button) ───────────────
    const onKeyBack = useCallback(() => {
        setPending(null);
        setStage("pick-provider");
    }, []);

    return {
        stage,
        config,
        setConfig,
        pending,
        onProviderSelect,
        onKeySubmit,
        onKeyBack,
    };
}
