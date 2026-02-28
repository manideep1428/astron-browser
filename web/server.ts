/**
 * WebSocket server that bridges the React frontend to the Python browser-use daemon.
 * Run with: bun server.ts
 */

import { resolve } from "path";
import { existsSync } from "fs";

const PORT = 8765;
const scriptDir = import.meta.dir;
const browserDir = resolve(scriptDir, "..");
const pythonDir = resolve(browserDir, "python");

// ── Check Python setup ──────────────────────────────────────────────

async function commandExists(cmd: string[]): Promise<boolean> {
    try {
        const proc = Bun.spawn({ cmd, stdout: "ignore", stderr: "ignore" });
        return (await proc.exited) === 0;
    } catch {
        return false;
    }
}

async function ensureDependencies() {
    const pyprojectPath = resolve(browserDir, "pyproject.toml");
    const venvPath = resolve(browserDir, ".venv");

    if (existsSync(pyprojectPath) && existsSync(venvPath)) {
        return;
    }

    console.log("🔧 Setting up browser-use environment...\n");

    const hasPython = await commandExists(["python", "--version"]);
    if (!hasPython) {
        console.error("✗ Python not found! Please install Python >= 3.11");
        process.exit(1);
    }

    let hasUv = await commandExists(["uv", "--version"]);
    if (!hasUv) {
        console.log("⏳ Installing uv...");
        const proc = Bun.spawn({
            cmd: ["pip", "install", "uv"],
            stdout: "inherit",
            stderr: "inherit",
        });
        await proc.exited;
    }

    if (!existsSync(pyprojectPath)) {
        const proc = Bun.spawn({
            cmd: ["uv", "init", "--no-readme"],
            stdout: "inherit",
            stderr: "inherit",
            cwd: browserDir,
        });
        await proc.exited;
    }

    const addProc = Bun.spawn({
        cmd: ["uv", "add", "browser-use"],
        stdout: "inherit",
        stderr: "inherit",
        cwd: browserDir,
    });
    await addProc.exited;

    const syncProc = Bun.spawn({
        cmd: ["uv", "sync"],
        stdout: "inherit",
        stderr: "inherit",
        cwd: browserDir,
    });
    await syncProc.exited;

    console.log("✅ Setup complete!");
}

// ── Daemon management ────────────────────────────────────────────────

interface DaemonState {
    process: ReturnType<typeof Bun.spawn> | null;
    isReady: boolean;
    clients: Set<WebSocket>;
}

const daemon: DaemonState = {
    process: null,
    isReady: false,
    clients: new Set(),
};

async function startDaemon() {
    if (daemon.process) {
        console.log("  Daemon already running");
        return;
    }

    await ensureDependencies();

    console.log("🚀 Starting Python daemon...");

    daemon.process = Bun.spawn({
        cmd: ["uv", "run", "python", "-u", resolve(pythonDir, "daemon.py")],
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        cwd: browserDir,
    });

    // Stream stdout
    const stdoutReader = daemon.process.stdout.getReader();
    const stdoutDecoder = new TextDecoder();

    (async () => {
        while (true) {
            const { value, done } = await stdoutReader.read();
            if (done) break;

            const chunk = stdoutDecoder.decode(value);
            const parts = chunk.split("__DONE__");

            for (let i = 0; i < parts.length; i++) {
                const text = parts[i];

                if (!daemon.isReady && text.includes("Browser started")) {
                    daemon.isReady = true;
                    broadcast({ type: "status", status: "ready" });
                }

                if (text.trim()) {
                    broadcast({ type: "output", text });
                }

                if (i < parts.length - 1) {
                    broadcast({ type: "done" });
                }
            }
        }

        // Process exited
        daemon.process = null;
        daemon.isReady = false;
        broadcast({ type: "status", status: "disconnected" });
    })();

    // Stream stderr
    const stderrReader = daemon.process.stderr.getReader();
    const stderrDecoder = new TextDecoder();

    (async () => {
        while (true) {
            const { value, done } = await stderrReader.read();
            if (done) break;
            const chunk = stderrDecoder.decode(value);
            if (chunk.trim()) {
                broadcast({ type: "error", text: chunk });
            }
        }
    })();
}

function broadcast(msg: Record<string, unknown>) {
    const data = JSON.stringify(msg);
    for (const client of daemon.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

function sendTask(prompt: string) {
    if (!daemon.process || !daemon.isReady) {
        broadcast({
            type: "error",
            text: "Daemon is not ready yet. Please wait...",
        });
        return;
    }

    broadcast({ type: "status", status: "running" });
    broadcast({ type: "output", text: `\n> Task: ${prompt}\n\n` });
    daemon.process.stdin.write(prompt + "\n");
    daemon.process.stdin.flush();
}

// ── WebSocket server ─────────────────────────────────────────────────

const server = Bun.serve({
    port: PORT,
    fetch(req) {
        const url = new URL(req.url);

        // Handle WebSocket upgrade
        if (url.pathname === "/ws") {
            const upgraded = server.upgrade(req);
            if (!upgraded) {
                return new Response("WebSocket upgrade failed", { status: 400 });
            }
            return;
        }

        // Health check
        if (url.pathname === "/health") {
            return new Response(
                JSON.stringify({
                    daemon: daemon.isReady ? "ready" : "starting",
                    clients: daemon.clients.size,
                }),
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }

        return new Response("Browser Agent WebSocket Server", {
            headers: { "Access-Control-Allow-Origin": "*" },
        });
    },
    websocket: {
        open(ws: WebSocket) {
            daemon.clients.add(ws);
            console.log(`  Client connected (${daemon.clients.size} total)`);

            // Send current status
            ws.send(
                JSON.stringify({
                    type: "status",
                    status: daemon.isReady
                        ? "ready"
                        : daemon.process
                            ? "starting"
                            : "disconnected",
                })
            );
        },
        message(ws: WebSocket, message: string | Buffer) {
            try {
                const data = JSON.parse(message.toString());

                switch (data.type) {
                    case "task":
                        sendTask(data.prompt);
                        break;
                    case "start_daemon":
                        startDaemon();
                        break;
                    default:
                        ws.send(
                            JSON.stringify({ type: "error", text: `Unknown command: ${data.type}` })
                        );
                }
            } catch (e) {
                ws.send(
                    JSON.stringify({ type: "error", text: `Invalid message: ${e}` })
                );
            }
        },
        close(ws: WebSocket) {
            daemon.clients.delete(ws);
            console.log(`  Client disconnected (${daemon.clients.size} total)`);
        },
    },
});

console.log(`
╔══════════════════════════════════════════╗
║   🌐 Browser Agent WebSocket Server     ║
║   ws://localhost:${PORT}/ws               ║
╚══════════════════════════════════════════╝
`);

// Auto-start daemon
startDaemon();
