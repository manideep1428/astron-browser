import { Box, Text, useInput } from "ink";
import React from "react";

interface HelpOverlayProps {
  onExit: () => void;
}

const HelpOverlay: React.FC<HelpOverlayProps> = ({ onExit }) => {
  useInput((_input, key) => {
    if (key.escape || key.return) {
      onExit();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
      paddingY={1}
      width={60}
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">
          ◆ Help — Commands & Shortcuts
        </Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text bold color="cyan">
          Slash Commands
        </Text>
        <Box gap={1}>
          <Text color="white" bold>
            {"  /model "}
          </Text>
          <Text dimColor>Change model provider & model</Text>
        </Box>
        <Box gap={1}>
          <Text color="white" bold>
            {"  /keys  "}
          </Text>
          <Text dimColor>Manage saved API keys</Text>
        </Box>
        <Box gap={1}>
          <Text color="white" bold>
            {"  /config "}
          </Text>
          <Text dimColor>Show current configuration</Text>
        </Box>
        <Box gap={1}>
          <Text color="white" bold>
            {"  /help  "}
          </Text>
          <Text dimColor>Show this help menu</Text>
        </Box>
        <Box gap={1}>
          <Text color="white" bold>
            {"  /clear "}
          </Text>
          <Text dimColor>Clear conversation history</Text>
        </Box>
      </Box>

      <Box flexDirection="column" gap={0} marginTop={1}>
        <Text bold color="cyan">
          Keyboard Shortcuts
        </Text>
        <Box gap={1}>
          <Text color="white" bold>
            {"  Enter  "}
          </Text>
          <Text dimColor>Send message</Text>
        </Box>
        <Box gap={1}>
          <Text color="white" bold>
            {"  ↑ / ↓  "}
          </Text>
          <Text dimColor>Navigate command history</Text>
        </Box>
        <Box gap={1}>
          <Text color="white" bold>
            {"  Tab    "}
          </Text>
          <Text dimColor>Autocomplete command / cycle suggestions</Text>
        </Box>
        <Box gap={1}>
          <Text color="white" bold>
            {"  Esc    "}
          </Text>
          <Text dimColor>Interrupt running task</Text>
        </Box>
        <Box gap={1}>
          <Text color="white" bold>
            {"  Ctrl+C "}
          </Text>
          <Text dimColor>Quit</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press Esc or Enter to close</Text>
      </Box>
    </Box>
  );
};

export default HelpOverlay;
