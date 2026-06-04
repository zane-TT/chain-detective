import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AlertTriangle, Check, Copy, Crosshair, Languages, ListFilter, Loader2, Plus, Radio, RotateCcw, Search, ShieldCheck, Waypoints } from "lucide-react";
import { nexProject, seedEvents } from "../shared/seedData";
import type { ChainEvent, ChainKey, DetectorState, LifecycleSignal, TokenLiquidityAnalysis } from "../shared/types";
import {
  getCopy,
  getEventCopy,
  getMechanismCopy,
  getPhraseCopy,
  getPoolStatusCopy,
  getSignalCopy,
  getStatusCopy,
  localeNames,
  localeStorageKey,
  locales,
  resolveLocale,
  type Locale,
} from "./i18n";
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
  liquidityAnalyses: [],
  updatedAt: new Date().toISOString(),
};

function App() {
  const [state, setState] = useState<DetectorState>(initialState);
  const [connected, setConnected] = useState(false);
  const [locale, setLocale] = useState<Locale>(() =>
    resolveLocale(localStorage.getItem(localeStorageKey) ?? navigator.language),
  );
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenChain, setTokenChain] = useState<ChainKey>("bsc");
  const [tokenLabel, setTokenLabel] = useState("");
  const [watchStatus, setWatchStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [watchMessage, setWatchMessage] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [eventSeverityFilter, setEventSeverityFilter] = useState<"all" | ChainEvent["severity"]>("all");
  const [eventSearch, setEventSearch] = useState("");
  const [copiedAddress, setCopiedAddress] = useState("");
  const copy = getCopy(locale);
  const project = state.projects[0];
  const latestLiquidityAnalysis = state.liquidityAnalyses[0];
  const chainStatusItems = Object.entries(state.chains) as [ChainKey, DetectorState["status"]][];
  const tokenFormCopy =
    locale === "zh"
      ? {
          title: "添加代币监控",
          chain: "链",
          address: "代币合约地址",
          label: "备注",
          labelPlaceholder: "例如 NEX BSC token",
          addressPlaceholder: "0x...",
          submit: "加入监控",
          saving: "添加中",
          success: "已加入监控列表",
          empty: "请输入代币合约地址",
          watched: "已监控地址",
          reset: "清空",
        }
      : {
          title: "Add token watch",
          chain: "Chain",
          address: "Token contract address",
          label: "Label",
          labelPlaceholder: "e.g. NEX BSC token",
          addressPlaceholder: "0x...",
          submit: "Add watch",
          saving: "Adding",
          success: "Added to watchlist",
          empty: "Enter a token contract address",
          watched: "Watched addresses",
          reset: "Clear form",
        };
  const liquidityCopy =
    locale === "zh"
      ? {
          analyze: "分析流动池钱包",
          analyzing: "分析中",
          analyzeSuccess: "流动池钱包分析完成",
          analysisTitle: "流动池钱包画像",
          pools: "池子",
          wallets: "LP 钱包",
          relations: "关联关系",
          majorHolder: "持仓 >= 0.1%",
          noAnalysis: "输入代币地址后点击分析。",
          scanRange: "扫描区块",
          warnings: "注意",
        }
      : {
          analyze: "Analyze LP wallets",
          analyzing: "Analyzing",
          analyzeSuccess: "Liquidity wallet analysis complete",
          analysisTitle: "Liquidity wallet profile",
          pools: "Pools",
          wallets: "LP wallets",
          relations: "Relations",
          majorHolder: "Holding >= 0.1%",
          noAnalysis: "Enter a token address, then run analysis.",
          scanRange: "Scanned blocks",
          warnings: "Warnings",
        };
  const eventFilterCopy = {
    all: "All",
    alert: "Alerts",
    watch: "Watch",
    info: "Info",
  } as const;
  const normalizedEventSearch = eventSearch.trim().toLowerCase();
  const hasEventFilters = eventSeverityFilter !== "all" || Boolean(normalizedEventSearch);
  const hasTokenDraft = Boolean(tokenAddress.trim() || tokenLabel.trim());

  async function addTokenWatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tokenAddress.trim()) {
      setWatchStatus("error");
      setWatchMessage(tokenFormCopy.empty);
      return;
    }

    setWatchStatus("saving");
    setWatchMessage("");

    try {
      const response = await fetch("/api/watch-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chain: tokenChain,
          address: tokenAddress.trim(),
          label: tokenLabel.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { message?: string; state?: DetectorState };

      if (!response.ok || !payload.state) {
        throw new Error(payload.message ?? "Unable to add token address.");
      }

      setState(payload.state);
      setTokenAddress("");
      setTokenLabel("");
      setWatchStatus("success");
      setWatchMessage(tokenFormCopy.success);
    } catch (error) {
      setWatchStatus("error");
      setWatchMessage(error instanceof Error ? error.message : "Unable to add token address.");
    }
  }

  async function analyzeLiquidity() {
    if (!tokenAddress.trim()) {
      setAnalysisStatus("error");
      setAnalysisMessage(tokenFormCopy.empty);
      return;
    }

    setAnalysisStatus("loading");
    setAnalysisMessage("");

    try {
      const response = await fetch("/api/analyze-liquidity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chain: tokenChain,
          address: tokenAddress.trim(),
        }),
      });
      const payload = (await response.json()) as { message?: string; state?: DetectorState };

      if (!response.ok || !payload.state) {
        throw new Error(payload.message ?? "Unable to analyze token liquidity.");
      }

      setState(payload.state);
      setAnalysisStatus("success");
      setAnalysisMessage(liquidityCopy.analyzeSuccess);
    } catch (error) {
      setAnalysisStatus("error");
      setAnalysisMessage(error instanceof Error ? error.message : "Unable to analyze token liquidity.");
    }
  }

  async function copyWatchedAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress((current) => (current === address ? "" : current)), 1600);
    } catch {
      setWatchStatus("error");
      setWatchMessage("Unable to copy address.");
    }
  }

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

  useEffect(() => {
    localStorage.setItem(localeStorageKey, locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const criticalEvents = useMemo(
    () => state.events.filter((event) => event.severity !== "info").slice(0, 4),
    [state.events],
  );
  const filteredEvents = useMemo(
    () =>
      state.events
        .filter((event) => eventSeverityFilter === "all" || event.severity === eventSeverityFilter)
        .filter((event) => {
          if (!normalizedEventSearch) return true;

          return [event.title, event.detail, event.chain, event.signal, event.blockNumber ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedEventSearch);
        })
        .slice(0, 12),
    [eventSeverityFilter, normalizedEventSearch, state.events],
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
        <div className="topbar-actions">
          <div className="connection-card">
            <Radio size={18} />
            <div>
              <span>{connected ? copy.streamConnected : copy.waitingForStream}</span>
              <strong>{state.mode === "live" ? copy.liveRpc : copy.demoSeed}</strong>
            </div>
          </div>
          <LanguageSwitch label={copy.language} locale={locale} onChange={setLocale} />
        </div>
      </section>

      <section className="summary-grid">
        <MetricCard label={copy.watchedChains} value={`${chainStatusItems.length} chains`} detail={copy.evmFirst} icon={<Waypoints />}>
          <ChainStatusStrip chains={chainStatusItems} locale={locale} />
        </MetricCard>
        <MetricCard label={copy.detectorMode} value={state.mode.toUpperCase()} detail={getStatusCopy(locale, state.status)} icon={<Activity />} />
        <MetricCard label={copy.currentProject} value={project.symbol} detail={project.name} icon={<Crosshair />} />
        <MetricCard
          label={copy.mechanism}
          value={getMechanismCopy(locale, project.mechanism.type)}
          detail={`${project.mechanism.confidence}% ${copy.confidence}`}
          icon={<ShieldCheck />}
        />
      </section>

      <section className="watch-console">
        <form className="watch-form" onSubmit={addTokenWatch}>
          <div>
            <span className="eyebrow">{tokenFormCopy.title}</span>
            <div className="watch-fields">
              <label>
                <span>{tokenFormCopy.chain}</span>
                <select value={tokenChain} onChange={(event) => setTokenChain(event.target.value as ChainKey)}>
                  <option value="bsc">BSC</option>
                  <option value="ethereum">Ethereum</option>
                </select>
              </label>
              <label className="address-field">
                <span>{tokenFormCopy.address}</span>
                <input
                  value={tokenAddress}
                  onChange={(event) => setTokenAddress(event.target.value)}
                  placeholder={tokenFormCopy.addressPlaceholder}
                  spellCheck={false}
                />
              </label>
              <label>
                <span>{tokenFormCopy.label}</span>
                <input
                  value={tokenLabel}
                  onChange={(event) => setTokenLabel(event.target.value)}
                  placeholder={tokenFormCopy.labelPlaceholder}
                />
              </label>
            </div>
          </div>
          <div className="watch-actions">
            <button type="submit" disabled={watchStatus === "saving"}>
              {watchStatus === "saving" ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
              {watchStatus === "saving" ? tokenFormCopy.saving : tokenFormCopy.submit}
            </button>
            <button type="button" className="secondary" disabled={analysisStatus === "loading"} onClick={analyzeLiquidity}>
              {analysisStatus === "loading" ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
              {analysisStatus === "loading" ? liquidityCopy.analyzing : liquidityCopy.analyze}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!hasTokenDraft}
              onClick={() => {
                setTokenAddress("");
                setTokenLabel("");
                setWatchStatus("idle");
                setWatchMessage("");
                setAnalysisStatus("idle");
                setAnalysisMessage("");
              }}
            >
              <RotateCcw size={18} />
              {tokenFormCopy.reset}
            </button>
          </div>
        </form>
        <div className={`watch-message ${watchStatus}`}>{watchMessage}</div>
        <div className={`watch-message ${analysisStatus}`}>{analysisMessage}</div>
        <div className="watch-list" aria-label={tokenFormCopy.watched}>
          <span>{tokenFormCopy.watched}</span>
          <div>
            {project.contracts.map((target) => (
              <span className="watch-chip" key={target.id}>
                <code>
                  {target.chain.toUpperCase()} / {target.address.slice(0, 8)}...{target.address.slice(-6)}
                </code>
                <button
                  type="button"
                  aria-label={`Copy ${target.chain.toUpperCase()} address`}
                  onClick={() => void copyWatchedAddress(target.address)}
                >
                  {copiedAddress === target.address ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </span>
            ))}
          </div>
        </div>
        <LiquidityAnalysisPanel analysis={latestLiquidityAnalysis} labels={liquidityCopy} />
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
          <SignalStrip signals={project.currentSignals} locale={locale} />
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
            <EvidenceList title={copy.evidence} items={project.mechanism.evidence} locale={locale} positive />
            <EvidenceList title={copy.missing} items={project.mechanism.missing} locale={locale} />
          </div>
        </Panel>

        <Panel title={copy.liveEventStream} action={`${filteredEvents.length} / ${state.events.length}`}>
          <div className="event-filter" aria-label="Filter event severity">
            <ListFilter size={16} />
            {(["all", "alert", "watch", "info"] as const).map((severity) => (
              <button
                key={severity}
                type="button"
                className={eventSeverityFilter === severity ? "active" : ""}
                aria-pressed={eventSeverityFilter === severity}
                onClick={() => setEventSeverityFilter(severity)}
              >
                {eventFilterCopy[severity]}
              </button>
            ))}
            <label className="event-search">
              <Search size={14} />
              <input
                value={eventSearch}
                onChange={(event) => setEventSearch(event.target.value)}
                placeholder="Search events"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label="Clear event filters"
              disabled={!hasEventFilters}
              onClick={() => {
                setEventSeverityFilter("all");
                setEventSearch("");
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <div className="event-list">
            {filteredEvents.map((event) => (
              <EventRow key={event.id} event={event} locale={locale} />
            ))}
          </div>
        </Panel>

        <Panel title={copy.poolSnapshot} action={copy.nexSeed}>
          <div className="snapshot-grid">
            <SnapshotItem label={copy.openTime} value={project.pool.openTime} />
            <SnapshotItem label={copy.targetPush} value={getPhraseCopy(locale, project.pool.buyToTargetFdv)} />
            <SnapshotItem label={copy.totalSupply} value={project.supply.total} />
            <SnapshotItem label={copy.bridgedToBsc} value={getPhraseCopy(locale, project.supply.bridgedToBsc)} />
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
          <EventRow key={`critical-${event.id}`} event={event} locale={locale} compact />
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
  children,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {children}
    </article>
  );
}

function ChainStatusStrip({ chains, locale }: { chains: [ChainKey, DetectorState["status"]][]; locale: Locale }) {
  return (
    <div className="chain-status-strip">
      {chains.map(([chain, status]) => (
        <span className={`chain-status ${status}`} key={chain}>
          {chain.toUpperCase()} / {getStatusCopy(locale, status)}
        </span>
      ))}
    </div>
  );
}

function LiquidityAnalysisPanel({
  analysis,
  labels,
}: {
  analysis?: TokenLiquidityAnalysis;
  labels: {
    analysisTitle: string;
    pools: string;
    wallets: string;
    relations: string;
    majorHolder: string;
    noAnalysis: string;
    scanRange: string;
    warnings: string;
  };
}) {
  if (!analysis) {
    return (
      <section className="liquidity-panel empty">
        <span className="eyebrow">{labels.analysisTitle}</span>
        <p>{labels.noAnalysis}</p>
      </section>
    );
  }

  const majorWallets = analysis.wallets.filter((wallet) => wallet.isMajorHolder);

  return (
    <section className="liquidity-panel">
      <header>
        <div>
          <span className="eyebrow">{labels.analysisTitle}</span>
          <strong>
            {analysis.chain.toUpperCase()} / {analysis.tokenAddress.slice(0, 8)}...{analysis.tokenAddress.slice(-6)}
          </strong>
        </div>
        <div className="analysis-meta">
          <span className={`analysis-status ${analysis.status}`}>{analysis.status}</span>
          <span>{new Date(analysis.updatedAt).toLocaleTimeString()}</span>
          <span>
            {labels.scanRange} {analysis.scannedFromBlock}-{analysis.scannedToBlock}
          </span>
        </div>
      </header>
      <div className="liquidity-metrics">
        <SnapshotItem label={labels.pools} value={analysis.pools.length.toString()} />
        <SnapshotItem label={labels.wallets} value={analysis.wallets.length.toString()} />
        <SnapshotItem label={labels.relations} value={analysis.relations.length.toString()} />
        <SnapshotItem label={labels.majorHolder} value={majorWallets.length.toString()} />
      </div>
      <div className="liquidity-table">
        <div className="liquidity-head">
          <span>Wallet</span>
          <span>Share</span>
          <span>Pools</span>
          <span>Relations</span>
        </div>
        {analysis.wallets.slice(0, 8).map((wallet) => (
          <div className={wallet.isMajorHolder ? "liquidity-row major" : "liquidity-row"} key={wallet.address}>
            <code>{wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}</code>
            <span>{wallet.totalSupplySharePercent.toFixed(4)}%</span>
            <span>{wallet.poolAddresses.length}</span>
            <span>{wallet.relations.length}</span>
          </div>
        ))}
      </div>
      <div className="pool-chip-row">
        {analysis.pools.slice(0, 6).map((pool) => (
          <code key={pool.pairAddress}>
            {pool.dex} / {pool.pairAddress.slice(0, 8)}...{pool.pairAddress.slice(-6)} / {pool.providerCount}
          </code>
        ))}
      </div>
      {analysis.warnings.length > 0 && (
        <div className="analysis-warnings">
          <span>{labels.warnings}</span>
          {analysis.warnings.slice(0, 3).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
    </section>
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

function LanguageSwitch({
  label,
  locale,
  onChange,
}: {
  label: string;
  locale: Locale;
  onChange: (locale: Locale) => void;
}) {
  return (
    <div className="language-switch" aria-label={label}>
      <Languages size={16} />
      <div>
        {locales.map((item) => (
          <button
            key={item}
            type="button"
            className={item === locale ? "active" : ""}
            aria-pressed={item === locale}
            onClick={() => onChange(item)}
          >
            {localeNames[item]}
          </button>
        ))}
      </div>
    </div>
  );
}

function SignalStrip({ signals, locale }: { signals: LifecycleSignal[]; locale: Locale }) {
  return (
    <div className="signal-strip">
      {signals.map((signal) => (
        <span key={signal}>{getSignalCopy(locale, signal)}</span>
      ))}
    </div>
  );
}

function EvidenceList({
  title,
  items,
  locale,
  positive = false,
}: {
  title: string;
  items: string[];
  locale: Locale;
  positive?: boolean;
}) {
  return (
    <div className={positive ? "evidence positive" : "evidence"}>
      <span>{title}</span>
      {items.map((item) => (
        <p key={item}>{getPhraseCopy(locale, item)}</p>
      ))}
    </div>
  );
}

function EventRow({ event, locale, compact = false }: { event: ChainEvent; locale: Locale; compact?: boolean }) {
  const eventCopy = getEventCopy(locale, event);
  const blockLabel = getCopy(locale).block;
  const localeTag = locale === "zh" ? "zh-CN" : "en-US";

  return (
    <article className={`event-row ${event.severity} ${compact ? "compact" : ""}`}>
      <div className="event-dot" />
      <div>
        <div className="event-title">
          <strong>{eventCopy.title}</strong>
          <span>{event.chain}</span>
        </div>
        {!compact && <p>{eventCopy.detail}</p>}
        <small>
          {getSignalCopy(locale, event.signal)} / {new Date(event.timestamp).toLocaleTimeString(localeTag)}
          {event.blockNumber ? ` / ${blockLabel} ${event.blockNumber}` : ""}
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
