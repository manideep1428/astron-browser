/**
 * @file constants.ts
 * App-wide constants — version, noise filters, etc.
 * Keep this file pure (no React, no side-effects).
 */

export const VERSION = "0.1.0";

/**
 * Stderr lines to silently discard.
 *
 * IMPORTANT: Be conservative here.
 * [Agent], [Browser], [Controller], [BrowserSession] etc. are the real
 * step-by-step logs from browser-use that the user WANTS to see in the
 * terminal. Only filter bare Python logging boilerplate that has zero
 * useful information.
 */
export const STDERR_NOISE_PATTERNS: RegExp[] = [
    // Pure Python logging level with nothing after it
    /^\s*INFO\s*$/,
    /^\s*DEBUG\s*$/,
    /^\s*WARNING\s*$/,
    // Playwright / Chromium internal noise
    /DevTools listening on ws:/,
    /^\s*\[chromium\]/i,
];

export function isStderrNoise(line: string): boolean {
    return STDERR_NOISE_PATTERNS.some((p) => p.test(line));
}
