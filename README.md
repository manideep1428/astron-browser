# 🌐 astron

> AI-powered browser automation from the terminal. Point and command your browser with natural language.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🤖 **Multi-model support** — Use Browser Use, OpenAI, Google Gemini, or Anthropic models
- 🔑 **Secure API key management** — Keys saved in `~/.astron/config.json`, never in your project
- ⚡ **Daemon mode** — Persistent browser session for running multiple tasks without restarts
- 🎯 **One-shot mode** — Run a single task and exit
- 🎨 **Rich terminal UI** — Interactive React-based CLI with slash commands, history, and autocomplete
- 🔄 **Hot model switching** — Change models on-the-fly with `/model`, daemon restarts automatically

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Python](https://www.python.org/downloads/) >= 3.11
- [uv](https://docs.astral.sh/uv/) (auto-installed if missing)

## Installation

> **Note:** `astron-browser` is currently in **beta**. Install with the `@beta` tag:

```bash
npm i -g astron-browser@beta
```

## Quick Start

```bash
# Interactive daemon mode (recommended)
astron

# One-shot task
astron "Search Google for Bun.js"

# Force re-setup Python environment
astron --setup
```

## Configuration

All configuration is stored in `~/.astron/config.json` — a global config that persists across installs.

### Slash Commands

Once in interactive mode, type `/` to see available commands:

| Command   | Description                         |
| --------- | ----------------------------------- |
| `/model`  | Select provider & model             |
| `/keys`   | Manage saved API keys (edit/delete) |
| `/config` | Show current configuration          |
| `/help`   | Show keyboard shortcuts             |
| `/clear`  | Clear conversation history          |
| `/quit`   | Exit                                |

### Keyboard Shortcuts

| Key      | Action                     |
| -------- | -------------------------- |
| `Enter`  | Send message               |
| `↑ / ↓`  | Navigate command history   |
| `Tab`    | Autocomplete / suggestions |
| `Esc`    | Interrupt running task     |
| `Ctrl+C` | Quit                       |

## Supported Models

### Browser Use (Default)

- `default` — Fastest & most cost-effective for browser tasks

### Google Gemini

- `gemini-3.1-pro-preview` — Latest & most capable
- `gemini-3.0-flash-preview` — Fast & efficient
- `gemini-2.5-flash-preview-05-20`, `gemini-2.5-pro-preview-05-06`, `gemini-2.0-flash`

### OpenAI

- `gpt-5.2` — Best for coding & agentic tasks
- `gpt-5.1`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`
- `gpt-5.3-codex`, `gpt-5.2-codex`, `gpt-5.1-codex`
- `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `gpt-4o-mini`

### Anthropic

- `claude-opus-4-6` — Most capable
- `claude-sonnet-4-6` — Best balance
- `claude-haiku-4-5-20251001` — Fastest

## License

[MIT](LICENSE) © Manideep
