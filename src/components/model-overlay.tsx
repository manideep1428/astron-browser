import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import { PROVIDERS, type ModelProvider } from "../config.js";

interface ModelOverlayProps {
  currentProvider: string;
  currentModel: string;
  onSelect: (provider: ModelProvider, model: string) => void;
  onExit: () => void;
}

type Stage = "provider" | "model";

const ModelOverlay: React.FC<ModelOverlayProps> = ({
  currentProvider,
  currentModel,
  onSelect,
  onExit,
}) => {
  const [stage, setStage] = useState<Stage>("provider");
  const [providerIndex, setProviderIndex] = useState(() =>
    Math.max(
      0,
      PROVIDERS.findIndex((p) => p.id === currentProvider),
    ),
  );
  const [modelIndex, setModelIndex] = useState(0);
  const [selectedProvider, setSelectedProvider] =
    useState<ModelProvider | null>(null);

  useInput((_input, key) => {
    if (key.escape) {
      if (stage === "model") {
        setStage("provider");
        setSelectedProvider(null);
        return;
      }
      onExit();
      return;
    }

    if (stage === "provider") {
      if (key.upArrow) {
        setProviderIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setProviderIndex((i) => Math.min(PROVIDERS.length - 1, i + 1));
      } else if (key.return) {
        const provider = PROVIDERS[providerIndex]!;
        if (provider.models.length === 1) {
          onSelect(provider, provider.models[0]!.name);
        } else {
          setSelectedProvider(provider);
          setModelIndex(0);
          setStage("model");
        }
      }
    } else if (stage === "model" && selectedProvider) {
      if (key.upArrow) {
        setModelIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setModelIndex((i) =>
          Math.min(selectedProvider.models.length - 1, i + 1),
        );
      } else if (key.return) {
        onSelect(selectedProvider, selectedProvider.models[modelIndex]!.name);
      } else if (key.leftArrow) {
        setStage("provider");
        setSelectedProvider(null);
      }
    }
  });

  // Max model name width for alignment
  const maxNameLen = selectedProvider
    ? Math.max(...selectedProvider.models.map((m) => m.name.length))
    : 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={1}
      width={72}
    >
      {stage === "provider" ? (
        <>
          <Box marginBottom={1}>
            <Text bold color="cyan">
              ◆ Select Model Provider
            </Text>
          </Box>

          {PROVIDERS.map((provider, i) => {
            const isSelected = i === providerIndex;
            const isCurrent = provider.id === currentProvider;
            return (
              <Box key={provider.id} gap={1}>
                <Text color={isSelected ? "cyan" : "gray"}>
                  {isSelected ? "❯" : " "}
                </Text>
                <Text
                  color={
                    isSelected ? provider.color : isCurrent ? "white" : "gray"
                  }
                  bold={isSelected}
                >
                  {provider.name}
                </Text>
                {isCurrent && <Text dimColor> (active)</Text>}
                {isSelected && (
                  <Text dimColor>
                    {" "}
                    — {provider.models.length} model
                    {provider.models.length > 1 ? "s" : ""}
                  </Text>
                )}
              </Box>
            );
          })}

          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate • Enter select • Esc cancel</Text>
          </Box>
        </>
      ) : selectedProvider ? (
        <>
          <Box marginBottom={1}>
            <Text bold color={selectedProvider.color}>
              ◆ {selectedProvider.name} — Select Model
            </Text>
          </Box>

          {selectedProvider.models.map((model, i) => {
            const isSelected = i === modelIndex;
            const isCurrent =
              selectedProvider.id === currentProvider &&
              model.name === currentModel;
            return (
              <Box key={model.name} flexDirection="column">
                <Box gap={1}>
                  <Text color={isSelected ? "cyan" : "gray"}>
                    {isSelected ? "❯" : " "}
                  </Text>
                  <Text
                    color={isSelected ? "white" : isCurrent ? "white" : "gray"}
                    bold={isSelected}
                  >
                    {model.name.padEnd(maxNameLen)}
                  </Text>
                  {isCurrent && <Text dimColor> ✓</Text>}
                </Box>
                {isSelected && (
                  <Box paddingLeft={3}>
                    <Text dimColor italic>
                      {model.desc}
                    </Text>
                  </Box>
                )}
              </Box>
            );
          })}

          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate • Enter select • ← back • Esc back</Text>
          </Box>
        </>
      ) : null}
    </Box>
  );
};

export default ModelOverlay;
