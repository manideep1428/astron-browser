/**
 * Config management — saves/loads from ~/.astron/config.json
 *
 * Uses the user's home directory (cross-platform) so config persists
 * across installs and is not committed to source control.
 * Falls back to .config in project root for backwards compatibility.
 */

import { resolve, join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";

// ── Config paths ─────────────────────────────────────────────────────
const CONFIG_DIR = join(homedir(), ".astron");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const LEGACY_CONFIG_FILE = resolve(import.meta.dir, "..", ".config");

function ensureConfigDir(): void {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

// ── Provider / Model definitions ─────────────────────────────────────

export interface ModelProvider {
    id: string;
    name: string;
    models: { name: string; desc: string }[];
    envKey: string;
    importName: string;
    color: string;
    keyHint: string;
}

export const PROVIDERS: ModelProvider[] = [
    {
        id: "browser-use",
        name: "Browser Use",
        models: [
            { name: "default", desc: "Fastest & most cost-effective for browser tasks" },
        ],
        envKey: "BROWSER_USE_API_KEY",
        importName: "ChatBrowserUse",
        color: "cyan",
        keyHint: "Get $10 free credits → https://cloud.browser-use.com/new-api-key",
    },
    {
        id: "google",
        name: "Google Gemini",
        models: [
            { name: "gemini-3-flash", desc: "Stable (Flash)" },
            { name: "gemini-3-pro", desc: "Stable (Pro)" },
            { name: "gemini-2.0-flash", desc: "Stable flash model" },
            { name: "gemini-1.5-flash", desc: "Low latency & efficient" },
            { name: "gemini-1.5-pro", desc: "Most capable Gemini model" },
        ],
        envKey: "GOOGLE_API_KEY",
        importName: "ChatGoogle",
        color: "blue",
        keyHint: "Get free key → https://aistudio.google.com/app/apikey",
    },
    {
        id: "openai",
        name: "OpenAI",
        models: [
            { name: "gpt-5.2", desc: "Best for coding & agentic tasks across industries" },
            { name: "gpt-5.1", desc: "Best with configurable reasoning effort" },
            { name: "gpt-5", desc: "Previous intelligent reasoning model" },
            { name: "gpt-5-mini", desc: "Faster, cost-efficient version of GPT-5" },
            { name: "gpt-5-nano", desc: "Fastest, most cost-effective GPT-5" },
            { name: "gpt-5.3-codex", desc: "Most capable agentic coding model" },
            { name: "gpt-5.2-codex", desc: "Intelligent coding for long-horizon tasks" },
            { name: "gpt-5.1-codex", desc: "Optimized for agentic coding in Codex" },
            { name: "gpt-4.1", desc: "Previous gen flagship" },
            { name: "gpt-4.1-mini", desc: "Previous gen efficient" },
            { name: "gpt-4o", desc: "Multimodal flagship" },
            { name: "gpt-4o-mini", desc: "Small multimodal" },
        ],
        envKey: "OPENAI_API_KEY",
        importName: "ChatOpenAI",
        color: "green",
        keyHint: "Get key → https://platform.openai.com/api-keys",
    },
    {
        id: "anthropic",
        name: "Anthropic",
        models: [
            { name: "claude-opus-4-6", desc: "Most capable Claude model" },
            { name: "claude-sonnet-4-6", desc: "Best balance of speed & intelligence" },
            { name: "claude-haiku-4-5-20251001", desc: "Fastest & most affordable Claude" },
        ],
        envKey: "ANTHROPIC_API_KEY",
        importName: "ChatAnthropic",
        color: "yellow",
        keyHint: "Get key → https://console.anthropic.com/settings/keys",
    },
];

// ── Config interface ─────────────────────────────────────────────────

export interface AppConfig {
    provider: string;
    model: string;
    apiKeys: Record<string, string>;
}

const DEFAULT_CONFIG: AppConfig = {
    provider: "browser-use",
    model: "default",
    apiKeys: {},
};

// ── Load / Save ──────────────────────────────────────────────────────

export function loadConfig(): AppConfig {
    // 1. Try new location first (~/.astron/config.json)
    try {
        if (existsSync(CONFIG_FILE)) {
            const raw = readFileSync(CONFIG_FILE, "utf-8");
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_CONFIG, ...parsed };
        }
    } catch {
        // ignore parse errors
    }

    // 2. Fall back to legacy .config in project root (migrate if found)
    try {
        if (existsSync(LEGACY_CONFIG_FILE)) {
            const raw = readFileSync(LEGACY_CONFIG_FILE, "utf-8");
            const parsed = JSON.parse(raw);
            const config = { ...DEFAULT_CONFIG, ...parsed };
            // Auto-migrate to new location
            saveConfig(config);
            return config;
        }
    } catch {
        // ignore
    }

    return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: AppConfig): void {
    ensureConfigDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getProvider(id: string): ModelProvider | undefined {
    return PROVIDERS.find((p) => p.id === id);
}

/**
 * Get the active provider based on config, resolving defaults.
 */
export function getActiveProvider(config: AppConfig): ModelProvider {
    return getProvider(config.provider) ?? PROVIDERS[0]!;
}

/**
 * Check if the active provider has a valid API key saved.
 */
export function hasActiveApiKey(config: AppConfig): boolean {
    const provider = getActiveProvider(config);
    return Boolean(config.apiKeys[provider.envKey]);
}

/**
 * Delete a saved API key for a specific env key name.
 */
export function deleteApiKey(config: AppConfig, envKey: string): AppConfig {
    const newKeys = { ...config.apiKeys };
    delete newKeys[envKey];
    const newConfig = { ...config, apiKeys: newKeys };
    saveConfig(newConfig);
    return newConfig;
}

/**
 * Write all saved API keys to the .env file so Python can read them.
 * The .env is written in the project root (where pyproject.toml lives).
 */
export function syncEnvFile(config: AppConfig): void {
    const envPath = resolve(import.meta.dir, "..", ".env");
    let existing = "";
    try {
        if (existsSync(envPath)) {
            existing = readFileSync(envPath, "utf-8");
        }
    } catch { }

    const lines = existing.split("\n").filter((l) => l.trim() !== "");
    const envMap = new Map<string, string>();

    for (const line of lines) {
        const eqIdx = line.indexOf("=");
        if (eqIdx > 0) {
            envMap.set(line.substring(0, eqIdx).trim(), line.substring(eqIdx + 1).trim());
        }
    }

    // Remove all known API keys from the env map to prevent conflicts
    for (const provider of PROVIDERS) {
        envMap.delete(provider.envKey);
    }

    // Only set the active provider's API key
    const activeProvider = getActiveProvider(config);
    const activeKey = config.apiKeys[activeProvider.envKey];
    if (activeKey) {
        envMap.set(activeProvider.envKey, activeKey);
    }

    const output = Array.from(envMap.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");

    writeFileSync(envPath, output + "\n", "utf-8");
}

/**
 * Get the config directory path (for display in help text).
 */
export function getConfigPath(): string {
    return CONFIG_FILE;
}
