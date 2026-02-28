/**
 * @file hooks/use-messages.ts
 * Manages the conversation message list.
 *
 * Provides:
 *   - `messages`    — the current array of OutputMessage
 *   - `addMessage`  — stable callback to append a new message
 *   - `clearMessages` — wipe the list (used by /clear)
 */

import { useState, useCallback, useRef } from "react";
import type { OutputMessage } from "../types.js";

export interface UseMessagesReturn {
    messages: OutputMessage[];
    addMessage: (type: OutputMessage["type"], text: string) => void;
    clearMessages: () => void;
}

export function useMessages(): UseMessagesReturn {
    const [messages, setMessages] = useState<OutputMessage[]>([]);
    const counter = useRef(0);

    const addMessage = useCallback(
        (type: OutputMessage["type"], text: string) => {
            counter.current += 1;
            const uid = Math.random().toString(36).substring(2, 10);
            setMessages((prev) => [
                ...prev,
                {
                    id: `msg-${counter.current}-${uid}`,
                    type,
                    text,
                    timestamp: Date.now(),
                },
            ]);
        },
        [],
    );

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return { messages, addMessage, clearMessages };
}
