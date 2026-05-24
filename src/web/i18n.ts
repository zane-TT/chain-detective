import type { ChainEvent, DetectorState, LifecycleSignal, MechanismType } from "../shared/types";

export type Locale = "en" | "zh";

export const locales: Locale[] = ["en", "zh"];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

const uiCopy = {
  en: {
    tagline: "Realtime Alpha pool intelligence for EVM-first investigations.",
    streamConnected: "Stream connected",
    waitingForStream: "Waiting for stream",
    liveRpc: "Live RPC",
    demoSeed: "Demo seed",
    watchedChains: "Watched chains",
    evmFirst: "Solidity/EVM first",
    detectorMode: "Detector mode",
    currentProject: "Current project",
    mechanism: "Mechanism",
    confidence: "confidence",
    alphaRadar: "Alpha Radar",
    events: "events",
    project: "Project",
    chain: "Chain",
    pool: "Pool",
    initialFdv: "Initial FDV",
    buyout: "Buyout",
    mechanismDetective: "Mechanism Detective",
    ruleEngine: "Rule engine v0",
    classification: "Classification",
    mechanismSummary:
      "This looks like a timed Alpha pool instead of a subscription TGE because the seed evidence points to start-time gated swaps and does not show deposit/claim settlement.",
    evidence: "Evidence",
    missing: "Missing",
    liveEventStream: "Live Event Stream",
    poolSnapshot: "Pool & Supply Snapshot",
    nexSeed: "NEX seed",
    openTime: "Open time",
    targetPush: "Target push",
    totalSupply: "Total supply",
    bridgedToBsc: "Bridged to BSC",
    minimumUsefulFeature: "Minimum useful feature",
    minimumUsefulFeatureBody:
      "The app already separates the realtime detector from the UI. Add RPC URLs and the server polls watched Solidity contracts, streams fresh logs, and keeps the browser updated through WebSocket.",
    block: "block",
  },
  zh: {
    tagline: "面向 EVM 调查的实时 Alpha 池情报台。",
    streamConnected: "数据流已连接",
    waitingForStream: "等待数据流",
    liveRpc: "实时 RPC",
    demoSeed: "演示数据",
    watchedChains: "监控链",
    evmFirst: "优先覆盖 Solidity/EVM",
    detectorMode: "检测模式",
    currentProject: "当前项目",
    mechanism: "机制",
    confidence: "可信度",
    alphaRadar: "Alpha 雷达",
    events: "条事件",
    project: "项目",
    chain: "链",
    pool: "池子",
    initialFdv: "初始 FDV",
    buyout: "买穿成本",
    mechanismDetective: "机制侦测",
    ruleEngine: "规则引擎 v0",
    classification: "分类",
    mechanismSummary:
      "种子证据指向受开始时间约束的交易路径，且没有出现存入/领取结算流程，因此它更像定时 Alpha 池，而不是认购式 TGE。",
    evidence: "证据",
    missing: "缺失项",
    liveEventStream: "实时事件流",
    poolSnapshot: "池子与供应快照",
    nexSeed: "NEX 种子数据",
    openTime: "开放时间",
    targetPush: "目标推动",
    totalSupply: "总供应量",
    bridgedToBsc: "跨到 BSC",
    minimumUsefulFeature: "最小可用功能",
    minimumUsefulFeatureBody:
      "应用已经把实时检测器和界面拆开。配置 RPC URL 后，服务端会轮询被监控的 Solidity 合约，推送最新日志，并通过 WebSocket 保持浏览器同步。",
    block: "区块",
  },
} as const;

const statusCopy: Record<Locale, Record<DetectorState["status"], string>> = {
  en: {
    demo: "Seeded without RPC",
    live: "Polling active",
    connecting: "Opening RPC",
    degraded: "RPC degraded",
    offline: "Offline",
  },
  zh: {
    demo: "未配置 RPC，使用种子数据",
    live: "轮询已启动",
    connecting: "正在打开 RPC",
    degraded: "RPC 异常",
    offline: "离线",
  },
};

const mechanismCopy: Record<Locale, Record<MechanismType, string>> = {
  en: {
    "Timed Alpha Pool": "Timed Alpha Pool",
    "TGE Subscription": "TGE Subscription",
    "Bonding Curve Sale": "Bonding Curve Sale",
    "Fair Launch": "Fair Launch",
    Unknown: "Unknown",
  },
  zh: {
    "Timed Alpha Pool": "定时 Alpha 池",
    "TGE Subscription": "TGE 认购",
    "Bonding Curve Sale": "联合曲线销售",
    "Fair Launch": "公平发射",
    Unknown: "未知",
  },
};

const signalCopy: Record<Locale, Partial<Record<ChainEvent["signal"] | LifecycleSignal, string>>> = {
  en: {},
  zh: {
    "New Hook": "新 Hook",
    "Pool Initialized": "池子已初始化",
    "Liquidity Added": "已添加流动性",
    "Trading Locked": "交易锁定",
    "StartTime Detected": "检测到开始时间",
    "Trading Open": "交易开放",
    "CEX Funding": "CEX 资金",
    "Cross-chain Active": "跨链活跃",
    "Single-sided Pool": "单边池",
    "Unknown Mechanism": "未知机制",
    Block: "新区块",
    Transfer: "转账",
    "Log Match": "日志命中",
  },
};

const poolStatusCopy: Record<Locale, Record<string, string>> = {
  en: {},
  zh: {
    seeded: "种子数据",
    watching: "监控中",
    live: "实时",
    unknown: "未知",
  },
};

export function getCopy(locale: Locale) {
  return uiCopy[locale];
}

export function getStatusCopy(locale: Locale, status: DetectorState["status"]) {
  return statusCopy[locale][status];
}

export function getMechanismCopy(locale: Locale, mechanism: MechanismType) {
  return mechanismCopy[locale][mechanism];
}

export function getSignalCopy(locale: Locale, signal: ChainEvent["signal"] | LifecycleSignal) {
  return signalCopy[locale][signal] ?? signal;
}

export function getPoolStatusCopy(locale: Locale, status: string) {
  return poolStatusCopy[locale][status] ?? status;
}

