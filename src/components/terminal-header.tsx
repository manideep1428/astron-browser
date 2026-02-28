import { Box, Text } from "ink";
import React from "react";

interface TerminalHeaderProps {
  version: string;
  model: string;
  mode: "daemon" | "one-shot";
  sessionId?: string;
}

const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  version,
  model,
  mode,
  sessionId,
}) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Top separator line */}
      <Box>
        <Text dimColor>{"─".repeat(62)}</Text>
      </Box>

      {/* Info row */}
      <Box paddingX={1} gap={2}>
        {/* Dot + name */}
        <Box gap={1}>
          <Text color="green" bold>
            ●
          </Text>
          <Text bold color="greenBright">
            astron
          </Text>
          <Text dimColor>v{version}</Text>
        </Box>

        {/* Divider */}
        <Text dimColor>·</Text>

        {/* Mode badge */}
        <Box gap={1}>
          <Text dimColor>mode</Text>
          <Text color={mode === "daemon" ? "cyan" : "yellow"} bold>
            {mode}
          </Text>
        </Box>

        {/* Divider */}
        <Text dimColor>·</Text>

        {/* Session */}
        {sessionId && (
          <Box gap={1}>
            <Text dimColor>session</Text>
            <Text color="magentaBright">{sessionId}</Text>
          </Box>
        )}
      </Box>

      {/* Bottom separator line */}
      <Box>
        <Text dimColor>{"─".repeat(62)}</Text>
      </Box>
    </Box>
  );
};

export default TerminalHeader;
