import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import { PROVIDERS, type AppConfig } from "../config.js";

interface KeysOverlayProps {
  config: AppConfig;
  onDelete: (envKey: string) => void;
  onEdit: (providerId: string) => void;
  onExit: () => void;
}

const KeysOverlay: React.FC<KeysOverlayProps> = ({
  config,
  onDelete,
  onEdit,
  onExit,
}) => {
  const items = PROVIDERS.map((p) => ({
    provider: p,
    key: config.apiKeys[p.envKey] || "",
  }));

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useInput((_input, key) => {
    if (confirmDelete) {
      if (_input === "y" || _input === "Y") {
        onDelete(confirmDelete);
        setConfirmDelete(null);
      } else {
        setConfirmDelete(null);
      }
      return;
    }

    if (key.escape) {
      onExit();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (key.return || _input === "e") {
      // Edit — go to API key input for this provider
      const item = items[selectedIndex];
      if (item) {
        onEdit(item.provider.id);
      }
    } else if (_input === "d" || _input === "D" || key.delete) {
      // Delete
      const item = items[selectedIndex];
      if (item && item.key) {
        setConfirmDelete(item.provider.envKey);
      }
    }
  });

  const maskKey = (k: string): string => {
    if (!k) return "";
    return k.slice(0, 8) + "•".repeat(Math.max(0, k.length - 12)) + k.slice(-4);
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
      paddingY={1}
      width={72}
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">
          🔐 Manage API Keys
        </Text>
      </Box>

      {items.map((item, i) => {
        const isSelected = i === selectedIndex;
        const hasKey = Boolean(item.key);
        return (
          <Box key={item.provider.id} flexDirection="column">
            <Box gap={1}>
              <Text color={isSelected ? "cyan" : "gray"}>
                {isSelected ? "❯" : " "}
              </Text>
              <Text
                color={isSelected ? item.provider.color : "gray"}
                bold={isSelected}
              >
                {item.provider.name}
              </Text>
              <Text dimColor>({item.provider.envKey})</Text>
            </Box>
            <Box paddingLeft={3}>
              {hasKey ? (
                <Box gap={1}>
                  <Text color="green">✓</Text>
                  <Text color="gray">{maskKey(item.key)}</Text>
                </Box>
              ) : (
                <Box gap={1}>
                  <Text color="red">✗</Text>
                  <Text dimColor>not set</Text>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}

      {/* Delete confirmation */}
      {confirmDelete && (
        <Box marginTop={1} gap={1}>
          <Text color="red" bold>
            Delete this key? (y/n)
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate • Enter/e edit • d delete • Esc close</Text>
      </Box>
    </Box>
  );
};

export default KeysOverlay;
