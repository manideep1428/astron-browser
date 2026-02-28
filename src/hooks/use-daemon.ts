/**
 * @file hooks/use-daemon.ts
 * Manages the Python browser-use daemon process lifecycle.
 *
 * Responsibilities:
 *   - Spawning / killing the daemon via Bun.spawn
 *   - Reading stdout and parsing __DONE__ delimiters
 *   - Filtering stderr noise and routing errors
 *   - Providing `isReady`, `startDaemon`, `stopDaemon`, `sendTask`
 *
 * This hook has NO rendering logic — it is purely a process manager.
 */

import { useState, useCallback, useRef } from "react";
import { resolve } from "path";
import { syncEnvFile } from "../config.js";
import { isStderrNoise } from "../constants.js";
import type { AppConfig } from "../types.js";
import type { OutputMessage } from "../types.js";

type AddMessage = (type: OutputMessage["type"], text: string) => void;

export interface UseDaemonReturn {
    isReady: boolean;
    isTaskRunning: boolean;
    startDaemon: (cfg: AppConfig) => void;
    stopDaemon: () => void;
    sendTask: (taskPrompt: string) => void;
}

export function useDaemon(addMessage: AddMessage): UseDaemonReturn {
    const [isReady, setIsReady] = useState(false);
    const daemonRef = useRef<ReturnType<typeof Bun.spawn> | null>(null);
    const isReadyRef = useRef(false);
    const isTaskRunningRef = useRef(false);

    // ── Stop ─────────────────────────────────────────────────────────
    const stopDaemon = useCallback(() => {
        const d = daemonRef.current;
        if (d) {
            const h = d.stdin as { end?: () => void };
            h?.end?.();
            daemonRef.current = null;
        }
        isReadyRef.current = false;
        setIsReady(false);
    }, []);

    // ── Start ─────────────────────────────────────────────────────────
    const startDaemon = useCallback(
        (cfg: AppConfig) => {
            stopDaemon();

            const scriptDir = import.meta.dir;
            const projectRoot = resolve(scriptDir, "../..");
            const pythonDir = resolve(projectRoot, "python");

            syncEnvFile(cfg);

            const daemon = Bun.spawn({
                cmd: [
                    "uv",
                    "run",
                    "python",
                    "-u",
                    resolve(pythonDir, "daemon.py"),
                    cfg.provider,
                    cfg.model,
                ],
                stdin: "pipe",
                stdout: "pipe",
                stderr: "pipe",
                cwd: projectRoot,
            });

            daemonRef.current = daemon;

            // ── Stdout reader ────────────────────────────────────────────
            const stdoutReader = daemon.stdout.getReader();
            const decoder = new TextDecoder();

            (async () => {
                while (true) {
                    const { value, done } = await stdoutReader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const parts = chunk.split("__DONE__");

                    for (let i = 0; i < parts.length; i++) {
                        const text = parts[i] ?? "";
                        const trimmed = text.trim();

                        if (!isReadyRef.current && trimmed.includes("Browser started")) {
                            isReadyRef.current = true;
                            setIsReady(true);
                        } else if (trimmed) {
                            if (trimmed.startsWith("[error]")) {
                                addMessage("error", trimmed.replace("[error]", "").trim());
                            } else if (
                                trimmed.startsWith("[daemon]") ||
                                trimmed.startsWith("[system]")
                            ) {
                                addMessage(
                                    "system",
                                    trimmed.replace(/\[(daemon|system)\]/, "").trim(),
                                );
                            } else {
                                addMessage("agent", trimmed);
                            }
                        }

                        // Every __DONE__ delimiter = task finished
                        if (i < parts.length - 1) {
                            isTaskRunningRef.current = false;
                            addMessage("done", "Task completed");
                        }
                    }
                }
                addMessage("system", "Browser daemon stopped");
            })();

            // ── Stderr reader ────────────────────────────────────────────
            const stderrReader = daemon.stderr.getReader();
            const stderrDecoder = new TextDecoder();

            (async () => {
                while (true) {
                    const { value, done } = await stderrReader.read();
                    if (done) break;
                    const chunk = stderrDecoder.decode(value);
                    for (const line of chunk.split("\n")) {
                        const trimmed = line.trim();
                        if (trimmed && !isStderrNoise(trimmed)) {
                            const isError = /error|exception|traceback/i.test(trimmed);
                            addMessage(isError ? "error" : "agent", trimmed);
                        }
                    }
                }
            })();
        },
        [addMessage, stopDaemon],
    );

    // ── Send a task ───────────────────────────────────────────────────
    const sendTask = useCallback(
        (taskPrompt: string) => {
            if (!daemonRef.current || !isReadyRef.current) {
                addMessage("error", "Daemon is not ready yet. Please wait...");
                return;
            }
            isTaskRunningRef.current = true;
            const stdin = daemonRef.current.stdin as unknown as {
                write: (s: string) => void;
                flush: () => void;
            };
            stdin.write(taskPrompt + "\n");
            stdin.flush();
        },
        [addMessage],
    );

    return {
        isReady,
        isTaskRunning: isTaskRunningRef.current,
        startDaemon,
        stopDaemon,
        sendTask,
    };
}
