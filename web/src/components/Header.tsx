import React from "react";
import { StatusBadge } from "./StatusBadge";

interface HeaderProps {
  status: string;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ status, isConnected }) => {
  return (
    <header className="header">
      <div className="header-logo">
        <div className="header-logo-icon">🌐</div>
        <span className="header-logo-text">Browser Agent</span>
      </div>

      <div className="header-divider" />

      <div className="header-meta">
        <div className="header-meta-item">
          <span className="label">model:</span>
          <span className="value">browser-use</span>
        </div>
        <div className="header-meta-item">
          <span className="label">mode:</span>
          <span className="value">daemon</span>
        </div>
        <div className="header-meta-item">
          <span className="label">ws:</span>
          <span className="value">
            {isConnected ? "connected" : "disconnected"}
          </span>
        </div>
      </div>

      <div className="header-status">
        <StatusBadge status={status} />
      </div>
    </header>
  );
};
