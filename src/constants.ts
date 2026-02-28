/**
 * @file constants.ts
 * App-wide constants — version, noise filters, etc.
 * Keep this file pure (no React, no side-effects).
 */

export const VERSION = "0.1.0";

/** Patterns from Python's browser-use stderr that are just noise. */
export const STDERR_NOISE_PATTERNS: RegExp[] = [
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

export function isStderrNoise(line: string): boolean {
    return STDERR_NOISE_PATTERNS.some((p) => p.test(line));
}
