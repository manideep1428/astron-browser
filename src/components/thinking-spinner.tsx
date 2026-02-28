import { Box, Text } from "ink";
import React, { useState } from "react";
import { useInterval } from "use-interval";

interface ThinkingSpinnerProps {
  active: boolean;
}

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const ThinkingSpinner: React.FC<ThinkingSpinnerProps> = ({ active }) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [dots, setDots] = useState("");
  const [seconds, setSeconds] = useState(0);

  useInterval(
    () => {
      setFrameIndex((i) => (i + 1) % frames.length);
    },
    active ? 80 : null,
  );

  useInterval(
    () => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    },
    active ? 500 : null,
  );

  useInterval(
    () => {
      setSeconds((s) => s + 1);
    },
    active ? 1000 : null,
  );

  // Reset seconds when task completes
  React.useEffect(() => {
    if (!active) {
      setSeconds(0);
      setDots("");
    }
  }, [active]);

  if (!active) return null;

  const formatTime = (s: number): string => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
  };

  return (
    <Box gap={2}>
      <Text color="cyan">{frames[frameIndex]}</Text>
      <Text>Thinking{dots}</Text>
      <Text dimColor>({formatTime(seconds)})</Text>
    </Box>
  );
};

export default ThinkingSpinner;
