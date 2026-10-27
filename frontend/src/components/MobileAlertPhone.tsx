import { useState, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  X,
  AlertTriangle,
  Wifi,
  Battery,
  Signal,
  Flame,
  CheckCircle2,
} from "lucide-react";
import type { ScenarioResult, SimulatedAlert } from "../lib/types";

interface Props {
  result: ScenarioResult | null;
  focus: string;
  onFocus: (village: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

function playAlertTone() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(784, ctx.currentTime); // G5
    osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.15); // C6
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext blocked or unsupported; silent fallback
  }
}

export default function MobileAlertPhone({
  result,
  focus,
  onFocus,
  isOpen,
  onClose,
}: Props) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedVillage, setSelectedVillage] = useState(focus);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [forcedPreview, setForcedPreview] = useState(false);

  useEffect(() => {
    setSelectedVillage(focus);
  }, [focus]);

  const villageResult = result?.villages.find((v) => v.name === selectedVillage);
  const activeAlert = result?.alerts.find((a) => a.village === selectedVillage);
  const alertThreshold = result?.alert_threshold ?? 80;

  const isAlertActive = !!activeAlert || forcedPreview;
  const isDismissed = dismissedAlerts[selectedVillage] && !forcedPreview;

  const alertData: SimulatedAlert | null = activeAlert
    ? activeAlert
    : forcedPreview && villageResult
    ? {
        village: villageResult.name,
        level: villageResult.score >= 90 ? "urgent" : villageResult.score >= alertThreshold ? "alert" : "watch",
        score: villageResult.score,
        title: `Elephant Advisory: ${villageResult.name}`,
        body: `SIMULATION · Scenario score ${villageResult.score.toFixed(0)}/100. ${
          villageResult.simulated_sightings
        } simulated sightings within ${(villageResult.buffer_m / 1000).toFixed(1)} km in last 7 days. Avoid forest paths after dusk.`,
        issued: `${result?.current.scenario.date ?? "2026-10-12"}T18:00`,
        simulated: true,
      }
    : null;

  const triggerSound = () => {
    if (soundEnabled) {
      playAlertTone();
    }
  };

  const alertLevelColors = {
    watch: "#e2c36d",
    alert: "#f49758",
    urgent: "#ef7777",
  };

  const alertColor = alertData ? alertLevelColors[alertData.level] : "#48cfa2";

  if (!isOpen) return null;

  return (
    <div className="phone-modal-backdrop" role="dialog" aria-modal="true" aria-label="Mobile Alert Simulator">
      <div className="phone-modal-scrim" onClick={onClose} />
      
      <div className="phone-modal-container">
        {/* Top Control Bar */}
        <div className="phone-modal-header">
          <div className="phone-modal-title">
            <span className="live-indicator" />
            <span>Mobile Alert Notification Simulator</span>
            <span className="badge-simulation">Simulation only</span>
          </div>
          <div className="phone-modal-actions">
            <button
              className={`button-icon-subtle ${soundEnabled ? "active" : ""}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute alert audio" : "Enable alert audio"}
              aria-label="Toggle alert chime"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              className="button-icon-subtle"
              onClick={onClose}
              aria-label="Close mobile simulator"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Village quick selector */}
        <div className="phone-village-selector" role="tablist" aria-label="Select village for alert preview">
          {result?.villages.map((v) => {
            const hasAlert = result.alerts.some((a) => a.village === v.name);
            const isSelected = v.name === selectedVillage;
            return (
              <button
                key={v.name}
                role="tab"
                aria-selected={isSelected}
                className={`phone-village-chip ${isSelected ? "selected" : ""} ${hasAlert ? "has-alert" : ""}`}
                onClick={() => {
                  setSelectedVillage(v.name);
                  onFocus(v.name);
                  setForcedPreview(false);
                }}
              >
                {hasAlert && <span className="alert-dot" />}
                <span>{v.name}</span>
                <span className="chip-score">{v.score.toFixed(0)}</span>
              </button>
            );
          })}
        </div>

        {/* Physical Smartphone Frame */}
        <div className="phone-hardware">
          {/* Outer chassis rim */}
          <div className="phone-bezel">
            {/* Front Screen */}
            <div className="phone-screen">
              {/* Dynamic Island / Notch */}
              <div className="phone-notch">
                <div className="notch-camera" />
                <div className="notch-speaker" />
              </div>

              {/* Status Bar */}
              <div className="phone-status-bar">
                <span className="phone-time">18:42</span>
                <div className="phone-status-icons">
                  <Signal size={12} strokeWidth={2.5} />
                  <span className="phone-network">5G</span>
                  <Wifi size={12} strokeWidth={2.5} />
                  <Battery size={13} strokeWidth={2.5} />
                </div>
              </div>

              {/* Lockscreen Clock */}
              <div className="phone-lock-header">
                <div className="phone-lock-date">Wednesday, October 12</div>
                <div className="phone-lock-time">18:42</div>
                <div className="phone-lock-location">Mudumalai Wildlife Range · Tamil Nadu</div>
              </div>

              {/* Notification Center Content */}
              <div className="phone-notification-stack">
                {isAlertActive && alertData && !isDismissed ? (
                  <div
                    className={`phone-notification-card alert-${alertData.level}`}
                    role="alert"
                    style={{ borderColor: `${alertColor}55` }}
                  >
                    <div className="notification-header">
                      <div className="app-brand">
                        <span className="app-icon" style={{ background: alertColor }}>
                          <AlertTriangle size={13} color="#0c100f" strokeWidth={2.5} />
                        </span>
                        <span className="app-name">GeoSentinel Early Advisory</span>
                      </div>
                      <span className="notification-time">now</span>
                    </div>

                    <div className="notification-title">
                      <span className="alert-badge" style={{ background: `${alertColor}26`, color: alertColor }}>
                        {alertData.level.toUpperCase()}
                      </span>
                      <span>{alertData.title}</span>
                    </div>

                    <p className="notification-body">{alertData.body}</p>

                    <div className="notification-footer">
                      <span className="sim-disclaimer">
                        Demo notification · Follow official Forest Dept
                      </span>
                      <div className="notification-actions">
                        <button
                          className="notification-btn dismiss"
                          onClick={() => setDismissedAlerts({ ...dismissedAlerts, [selectedVillage]: true })}
                        >
                          Acknowledge
                        </button>
                        <button
                          className="notification-btn sound"
                          onClick={triggerSound}
                          title="Play alert tone"
                        >
                          <Volume2 size={12} /> Test Sound
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="phone-quiet-card">
                    <div className="quiet-icon">
                      <CheckCircle2 size={24} color="#48cfa2" />
                    </div>
                    <div className="quiet-title">No Active Advisories</div>
                    <p className="quiet-desc">
                      Scenario score for {selectedVillage} is <strong>{villageResult?.score.toFixed(0)}/100</strong>,
                      which is below the alert threshold (<strong>{alertThreshold} pts</strong>).
                    </p>
                    <button
                      className="button secondary phone-preview-trigger"
                      onClick={() => {
                        setForcedPreview(true);
                        setDismissedAlerts({ ...dismissedAlerts, [selectedVillage]: false });
                        triggerSound();
                      }}
                    >
                      <Flame size={14} /> Preview Alert Simulation
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Quick Tools */}
              <div className="phone-lock-footer">
                <div className="phone-quick-btn">
                  <span>🔦</span>
                </div>
                <div className="phone-home-indicator" />
                <div className="phone-quick-btn">
                  <span>📷</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Explanatory footer */}
        <div className="phone-modal-footer">
          <div className="threshold-info">
            <span className="info-label">Alert Trigger Condition:</span>
            <span>Scenario Score &ge; {alertThreshold} points</span>
            <span className="separator">·</span>
            <span className="info-label">Current Village Score:</span>
            <span style={{ color: alertColor, fontWeight: 600 }}>
              {villageResult?.score.toFixed(1)} / 100 ({villageResult?.category})
            </span>
          </div>
          <p className="research-note">
            ⚠️ <strong>College Research Prototype:</strong> This simulates how an early advisory push alert would look on a villager or forest guard&apos;s phone. No actual SMS, cellular broadcast, or phone tracking is executed.
          </p>
        </div>
      </div>
    </div>
  );
}
