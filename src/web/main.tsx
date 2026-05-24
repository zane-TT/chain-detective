import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AlertTriangle, Crosshair, Radio, ShieldCheck, Waypoints } from "lucide-react";
import { nexProject, seedEvents } from "../shared/seedData";
import type { ChainEvent, DetectorState, LifecycleSignal } from "../shared/types";
import { defaultLocale, getCopy, getMechanismCopy, getPoolStatusCopy, getStatusCopy } from "./i18n";
import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const initialState: DetectorState = {
  status: "demo",
  mode: "demo",
  chains: {
    bsc: "demo",
    ethereum: "demo",
  },
  projects: [nexProject],
  events: seedEvents,
  updatedAt: new Date().toISOString(),
};

function App() {
  const [state, setState] = useState<DetectorState>(initialState);
  const [connected, setConnected] = useState(false);
  const locale = defaultLocale;
  const copy = getCopy(locale);
  const project = state.projects[0];

  useEffect(() => {
    const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/stream`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (message) => {
      const payload = JSON.parse(message.data) as { state: DetectorState };
      setState(payload.state);
    };

    return () => socket.close();
  }, []);

  const criticalEvents = useMemo(
    () => state.events.filter((event) => event.severity !== "info").slice(0, 4),
    [state.events],
  );

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <div className="brand-row">
            <div className="brand-mark">CD</div>
            <div>
              <h1>Chain Detective</h1>
              <p>{copy.tagline}</p>
            </div>
          </div>
        </div>
        <div className="connection-card">
          <Radio size={18} />
          <div>
            <span>{connected ? copy.streamConnected : copy.waitingForStream}</span>
            <strong>{state.mode === "live" ? copy.liveRpc : copy.demoSeed}</strong>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        <MetricCard label={copy.watchedChains} value="BSC + ETH" detail={copy.evmFirst} icon={<Waypoints />} />
        <MetricCard label={copy.detectorMode} value={state.mode.toUpperCase()} detail={getStatusCopy(locale, state.status)} icon={<Activity />} />
        <MetricCard label={copy.currentProject} value={project.symbol} detail={project.name} icon={<Crosshair />} />
        <MetricCard
          label={copy.mechanism}
          value={getMechanismCopy(locale, project.mechanism.type)}
          detail={`${project.mechanism.confidence}% ${copy.confidence}`}
          icon={<ShieldCheck />}
        />
      </section>

      <section className="workspace-grid">
        <Panel title={copy.alphaRadar} action={`${state.events.length} ${copy.events}`}>
          <div className="radar-table">
            <div className="radar-head">
              <span>{copy.project}</span>
              <span>{copy.chain}</span>
              <span>{copy.pool}</span>
              <span>{copy.initialFdv}</span>
              <span>{copy.buyout}</span>
            </div>
            <div className="radar-row">
              <div>
                <strong>{project.name}</strong>
                <small>{project.symbol}</small>
              </div>
              <span>BSC / ETH</span>
              <span>{getPoolStatusCopy(locale, project.pool.status)}</span>
              <span>{project.pool.initialFdv}</span>
              <span>{project.pool.buyoutCost}</span>
            </div>
          </div>
          <SignalStrip signals={project.currentSignals} />
        </Panel>

        <Panel title={copy.mechanismDetective} action={copy.ruleEngine}>
          <div className="mechanism-card">
            <div>
              <span className="eyebrow">{copy.classification}</span>
              <h2>{getMechanismCopy(locale, project.mechanism.type)}</h2>
              <p>{copy.mechanismSummary}</p>
            </div>
            <div className="confidence-ring">{project.mechanism.confidence}%</div>
          </div>
          <div className="evidence-grid">
            <EvidenceList title={copy.evidence} items={project.mechanism.evidence} positive />
            <EvidenceList title={copy.missing} items={project.mechanism.missing} />
          </div>
        </Panel>

        <Panel title={copy.liveEventStream} action={state.updatedAt.slice(11, 19)}>
          <div className="event-list">
            {state.events.slice(0, 12).map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        </Panel>

        <Panel title={copy.poolSnapshot} action={copy.nexSeed}>
          <div className="snapshot-grid">
            <SnapshotItem label={copy.openTime} value={project.pool.openTime} />
            <SnapshotItem label={copy.targetPush} value={project.pool.buyToTargetFdv} />
            <SnapshotItem label={copy.totalSupply} value={project.supply.total} />
            <SnapshotItem label={copy.bridgedToBsc} value={project.supply.bridgedToBsc} />
          </div>
          <div className="cex-row">
            {project.supply.watchedCex.map((cex) => (
              <span key={cex}>{cex}</span>
            ))}
          </div>
        </Panel>
      </section>

      <section className="alert-band">
        <div>
          <AlertTriangle size={20} />
          <strong>{copy.minimumUsefulFeature}</strong>
        </div>
        <p>{copy.minimumUsefulFeatureBody}</p>
      </section>

      <section className="critical-list">
        {criticalEvents.map((event) => (
          <EventRow key={`critical-${event.id}`} event={event} compact />
        ))}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Panel({ title, action, children }: { title: string; action: string; children: ReactNode }) {
  return (
    <section className="panel">
      <header>
        <h2>{title}</h2>
        <span>{action}</span>
      </header>
      {children}
    </section>
  );
}

function SignalStrip({ signals }: { signals: LifecycleSignal[] }) {
  return (
    <div className="signal-strip">
      {signals.map((signal) => (
        <span key={signal}>{signal}</span>
      ))}
    </div>
  );
}

function EvidenceList({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  return (
    <div className={positive ? "evidence positive" : "evidence"}>
      <span>{title}</span>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

function EventRow({ event, compact = false }: { event: ChainEvent; compact?: boolean }) {
  return (
    <article className={`event-row ${event.severity} ${compact ? "compact" : ""}`}>
      <div className="event-dot" />
      <div>
        <div className="event-title">
          <strong>{event.title}</strong>
          <span>{event.chain}</span>
        </div>
        {!compact && <p>{event.detail}</p>}
        <small>
          {event.signal} · {new Date(event.timestamp).toLocaleTimeString()}
          {event.blockNumber ? ` · block ${event.blockNumber}` : ""}
        </small>
      </div>
    </article>
  );
}

function SnapshotItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="snapshot-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
