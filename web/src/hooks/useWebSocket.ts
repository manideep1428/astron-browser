import { useEffect, useRef, useCallback, useState } from "react";

type Status = "disconnected" | "starting" | "ready" | "running";

interface Message {
    type: "output" | "error" | "done" | "status";
    text?: string;
    status?: Status;
}

export function useWebSocket(url: string) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
    const [status, setStatus] = useState<Status>("disconnected");
    const [messages, setMessages] = useState<
        Array<{ type: string; text: string; timestamp: number }>
    >([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isTaskRunning, setIsTaskRunning] = useState(false);

    const addMessage = useCallback(
        (type: string, text: string) => {
            setMessages((prev) => [...prev, { type, text, timestamp: Date.now() }]);
        },
        []
    );

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            addMessage("system", "Connected to server");

            // Ask server to start daemon
            ws.send(JSON.stringify({ type: "start_daemon" }));
        };

        ws.onmessage = (event) => {
            try {
                const data: Message = JSON.parse(event.data);

                switch (data.type) {
                    case "status":
                        setStatus(data.status!);
                        if (data.status === "ready") {
                            setIsTaskRunning(false);
                            addMessage("system", "🟢 Browser agent ready");
                        } else if (data.status === "starting") {
                            addMessage("system", "⏳ Starting browser daemon...");
                        } else if (data.status === "running") {
                            setIsTaskRunning(true);
                        } else if (data.status === "disconnected") {
                            setIsTaskRunning(false);
                            addMessage("system", "🔴 Daemon disconnected");
                        }
                        break;

                    case "output":
                        if (data.text?.trim()) {
                            addMessage("output", data.text);
                        }
                        break;

                    case "error":
                        if (data.text?.trim()) {
                            addMessage("error", data.text);
                        }
                        break;

                    case "done":
                        setIsTaskRunning(false);
                        setStatus("ready");
                        addMessage("done", "✔ Task completed");
                        break;
                }
            } catch {
                // ignore parse errors
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            setStatus("disconnected");

            // Auto-reconnect after 3s
            reconnectTimer.current = setTimeout(() => {
                connect();
            }, 3000);
        };

        ws.onerror = () => {
            addMessage("error", "Connection error — retrying...");
        };
    }, [url, addMessage]);

    const disconnect = useCallback(() => {
        if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
        }
        wsRef.current?.close();
        wsRef.current = null;
    }, []);

    const sendTask = useCallback((prompt: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "task", prompt }));
            setIsTaskRunning(true);
        }
    }, []);

    useEffect(() => {
        connect();
        return disconnect;
    }, [connect, disconnect]);

    return {
        status,
        messages,
        isConnected,
        isTaskRunning,
        sendTask,
        connect,
    };
}
