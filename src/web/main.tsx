import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AlertTriangle, Crosshair, Radio, ShieldCheck, Waypoints } from "lucide-react";
import { nexProject, seedEvents } from "../shared/seedData";
import type { ChainEvent, DetectorState, LifecycleSignal } from "../shared/types";
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
              <p>Realtime Alpha pool intelligence for EVM-first investigations.</p>
            </div>
          </div>
        </div>
        <div className="connection-card">
          <Radio size={18} />
          <div>
            <span>{connected ? "Stream connected" : "Waiting for stream"}</span>
            <strong>{state.mode === "live" ? "Live RPC" : "Demo seed"}</strong>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        <MetricCard label="Watched chains" value="BSC + ETH" detail="Solidity/EVM first" icon={<Waypoints />} />
        <MetricCard label="Detector mode" value={state.mode.toUpperCase()} detail={statusCopy(state.status)} icon={<Activity />} />
        <MetricCard label="Current project" value={project.symbol} detail={project.name} icon={<Crosshair />} />
        <MetricCard label="Mechanism" value={project.mechanism.type} detail={`${project.mechanism.confidence}% confidence`} icon={<ShieldCheck />} />
      </section>

      <section className="workspace-grid">
        <Panel title="Alpha Radar" action={`${state.events.length} events`}>
          <div className="radar-table">
            <div className="radar-head">
              <span>Project</span>
              <span>Chain</span>
              <span>Pool</span>
              <span>Initial FDV</span>
              <span>Buyout</span>
            </div>
            <div className="radar-row">
              <div>
                <strong>{project.name}</strong>
                <small>{project.symbol}</small>
              </div>
              <span>BSC / ETH</span>
              <span>{project.pool.status}</span>
              <span>{project.pool.initialFdv}</span>
              <span>{project.pool.buyoutCost}</span>
            </div>
          </div>
          <SignalStrip signals={project.currentSignals} />
        </Panel>

        <Panel title="Mechanism Detective" action="Rule engine v0">
          <div className="mechanism-card">
            <div>
              <span className="eyebrow">Classification</span>
              <h2>{project.mechanism.type}</h2>
              <p>
                This looks like a timed Alpha pool instead of a subscription TGE because the seed
                evidence points to start-time gated swaps and does not show deposit/claim settlement.
              </p>
            </div>
            <div className="confidence-ring">{project.mechanism.confidence}%</div>
          </div>
          <div className="evidence-grid">
            <EvidenceList title="Evidence" items={project.mechanism.evidence} positive />
            <EvidenceList title="Missing" items={project.mechanism.missing} />
          </div>
        </Panel>

        <Panel title="Live Event Stream" action={state.updatedAt.slice(11, 19)}>
          <div className="event-list">
            {state.events.slice(0, 12).map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        </Panel>

        <Panel title="Pool & Supply Snapshot" action="NEX seed">
          <div className="snapshot-grid">
            <SnapshotItem label="Open time" value={project.pool.openTime} />
            <SnapshotItem label="Target push" value={project.pool.buyToTargetFdv} />
            <SnapshotItem label="Total supply" value={project.supply.total} />
            <SnapshotItem label="Bridged to BSC" value={project.supply.bridgedToBsc} />
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
          <strong>Minimum useful feature</strong>
        </div>
        <p>
          The app already separates the realtime detector from the UI. Add RPC URLs and the server
          polls watched Solidity contracts, streams fresh logs, and keeps the browser updated through
          WebSocket.
        </p>
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

function statusCopy(status: DetectorState["status"]) {
  if (status === "demo") return "Seeded without RPC";
  if (status === "live") return "Polling active";
  if (status === "connecting") return "Opening RPC";
  if (status === "degraded") return "RPC degraded";
  return "Offline";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
