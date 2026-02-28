import React from "react";

interface StatusBadgeProps {
  status: string;
}

const statusLabels: Record<string, string> = {
  disconnected: "Offline",
  starting: "Starting",
  ready: "Ready",
  running: "Running",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`status-badge ${status}`}>
      <span className="status-dot" />
      {statusLabels[status] || status}
    </span>
  );
};
