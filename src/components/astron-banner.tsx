import { Box, Text } from "ink";
import React from "react";

/**
 * Big block-letter ASCII art for "ASTRON" in green.
 * Rendered with Ink's Text component so it shows in the terminal
 * exactly like the Gemini CLI banner.
 */

const ASTRON_ART = [
  " █████╗  ███████╗████████╗██████╗  ██████╗ ███╗   ██╗",
  "██╔══██╗ ██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗████╗  ██║",
  "███████║ ███████╗   ██║   ██████╔╝██║   ██║██╔██╗ ██║",
  "██╔══██║ ╚════██║   ██║   ██╔══██╗██║   ██║██║╚██╗██║",
  "██║  ██║ ███████║   ██║   ██║  ██║╚██████╔╝██║ ╚████║",
  "╚═╝  ╚═╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝",
];

export const AstronBanner: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {ASTRON_ART.map((line, i) => (
        <Text key={i} color="green" bold>
          {line}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>
          AI-powered browser automation from the terminal.{" "}
          <Text color="greenBright">Point and command your browser.</Text>
        </Text>
      </Box>
    </Box>
  );
};

export default AstronBanner;
