import { Box, Text, Static } from "ink";
import React from "react";
import TerminalHeader from "./terminal-header.js";
import AstronBanner from "./astron-banner.js";
import type { OutputMessage } from "../types.js";

// Re-export so existing consumers don't break
export type { OutputMessage };

interface MessageHistoryProps {
  messages: OutputMessage[];
  headerProps: {
    version: string;
    model: string;
    mode: "daemon" | "one-shot";
    sessionId?: string;
  };
}

const MessageHistory: React.FC<MessageHistoryProps> = ({
  messages,
  headerProps,
}) => {
  // Wrap messages with a header sentinel as the first static item
  const items: Array<{ kind: "header" } | { kind: "msg"; msg: OutputMessage }> =
    [
      { kind: "header" as const },
      ...messages.map((msg) => ({ kind: "msg" as const, msg })),
    ];

  return (
    <Static items={items}>
      {(item, index) => {
        if (item.kind === "header") {
          return (
            <Box key="__header__" flexDirection="column">
              <AstronBanner />
              <TerminalHeader {...headerProps} />
            </Box>
          );
        }

        const msg = item.msg;

        return (
          <Box
            key={msg.id}
            flexDirection="column"
            marginBottom={msg.type === "done" ? 1 : 0}
          >
            {msg.type === "done" ? (
              <Box gap={1}>
                <Text color="green" bold>
                  ✔
                </Text>
                <Text color="green">Task completed</Text>
              </Box>
            ) : msg.type === "user" ? (
              <Box flexDirection="column" marginY={1}>
                <Text bold color="blueBright">
                  you
                </Text>
                <Text>{msg.text}</Text>
              </Box>
            ) : msg.type === "error" ? (
              <Box>
                <Text color="red">{msg.text}</Text>
              </Box>
            ) : msg.type === "system" ? (
              <Box>
                <Text dimColor>{msg.text}</Text>
              </Box>
            ) : (
              /* agent output — green */
              <Box>
                <Text color="green">{msg.text}</Text>
              </Box>
            )}
          </Box>
        );
      }}
    </Static>
  );
};

export default MessageHistory;
