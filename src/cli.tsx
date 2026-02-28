#!/usr/bin/env bun

/**
 * astron — Codex-style React terminal UI for browser-use agent
 *
 * Uses Ink (React renderer for terminal) to provide a rich interactive
 * CLI experience, exactly like how OpenAI Codex CLI works.
 *
 * Usage:
 *   bun src/cli.tsx                    Start in daemon mode (interactive)
 *   bun src/cli.tsx "search for X"     Run a one-shot task then exit
 *   bun src/cli.tsx -d                 Explicit daemon mode
 *   bun src/cli.tsx --setup            Force re-run setup
 */

import { resolve } from "path";
import { existsSync } from "fs";
import { render } from "ink";
import React from "react";
import App from "./app.js";
import { loadConfig, syncEnvFile } from "./config.js";

const args = process.argv.slice(2);
const scriptDir = resolve(import.meta.dir, "..");
const projectRoot = scriptDir;

// ── Helpers ──────────────────────────────────────────────────────────

function usage() {
  console.log(`
  🌐 astron — Codex-style React CLI for browser-use agent

  Usage:
    astron                       Start interactive daemon mode
    astron "<task>"              Run a single task (spawns Python, then exits)
    astron -d | --daemon         Start persistent mode (keeps browser alive)
    astron --setup               Force re-run setup (reinstall dependencies)

  In daemon mode:
    Type a task and press Enter    Send task to the browser agent
    ↑ / ↓                         Navigate command history
    Tab                           Cycle through suggestions
    Esc                           Interrupt current task
    q / exit / Ctrl+C             Quit

  Examples:
    astron "Find stars of browser-use repo"
    astron --daemon
  `);
  process.exit(0);
}

/** Run a command and return true if it succeeds */
async function commandExists(cmd: string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn({
      cmd,
      stdout: "ignore",
      stderr: "ignore",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

/** Run a command with inherited output, throw on failure */
async function run(cmd: string[], label: string): Promise<void> {
  console.log(`  ▸ ${label}`);
  const proc = Bun.spawn({
    cmd,
    stdout: "inherit",
    stderr: "inherit",
    cwd: projectRoot,
  });
  const code = await proc.exited;
  if (code !== 0) {
    console.error(`\n  ✗ Failed: ${label}`);
    process.exit(1);
  }
}

// ── Setup / Dependency Check ─────────────────────────────────────────

async function ensureDependencies(force = false) {
  const pyprojectPath = resolve(projectRoot, "pyproject.toml");
  const venvPath = resolve(projectRoot, ".venv");

  if (!force && existsSync(pyprojectPath) && existsSync(venvPath)) {
    return;
  }

  console.log("\n  🔧 Setting up browser-use environment...\n");

  const hasPython = await commandExists(["python", "--version"]);
  if (!hasPython) {
    console.error("  ✗ Python not found! Please install Python >= 3.11 first.");
    process.exit(1);
  }
  console.log("  ✓ Python found");

  let hasUv = await commandExists(["uv", "--version"]);
  if (!hasUv) {
    console.log("  ⏳ Installing uv (Python package manager)...");
    await run(["pip", "install", "uv"], "pip install uv");
    hasUv = await commandExists(["uv", "--version"]);
    if (!hasUv) {
      console.error("  ✗ Failed to install uv.");
      process.exit(1);
    }
  }
  console.log("  ✓ uv found");

  if (!existsSync(pyprojectPath)) {
    await run(["uv", "init", "--no-readme"], "uv init");
  }

  await run(["uv", "add", "browser-use"], "uv add browser-use");
  await run(["uv", "sync"], "uv sync");

  console.log("\n  ✅ Setup complete! Ready to browse.\n");
}

// ── Entry point ──────────────────────────────────────────────────────

if (args.includes("--help") || args.includes("-h")) {
  usage();
}

if (args.includes("--setup")) {
  await ensureDependencies(true);
  console.log("  Done!");
  process.exit(0);
}

// Ensure deps are ready
await ensureDependencies();

// Determine mode
const isDaemon =
  args.length === 0 || args.includes("-d") || args.includes("--daemon");

const prompt = isDaemon
  ? undefined
  : args.filter((a) => !a.startsWith("-")).join(" ") || undefined;

// Sync API keys to .env before launching
const appConfig = loadConfig();
syncEnvFile(appConfig);

// Clear screen and render the React app with banner
console.clear();

const instance = render(
  <App prompt={prompt} mode={isDaemon ? "daemon" : "one-shot"} />,
);

// Graceful cleanup
const exit = () => {
  instance.unmount();
  process.exit(0);
};

process.on("SIGINT", exit);
process.on("SIGTERM", exit);
process.on("SIGQUIT", exit);

// Ctrl+C fallback in raw mode
if (process.stdin.isTTY) {
  const onRawData = (data: Buffer | string): void => {
    const str = Buffer.isBuffer(data) ? data.toString("utf8") : data;
    if (str === "\u0003") {
      exit();
    }
  };
  process.stdin.on("data", onRawData);
}

process.once("exit", () => {
  instance.unmount();
});
