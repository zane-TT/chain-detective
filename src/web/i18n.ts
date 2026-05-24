import type { ChainEvent, DetectorState, LifecycleSignal, MechanismType } from "../shared/types";

export type Locale = "en" | "zh";

export const locales: Locale[] = ["en", "zh"];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

export const localeStorageKey = "chain-detective-locale";

export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return defaultLocale;
  const normalized = value.toLowerCase();
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("en")) return "en";
  return defaultLocale;
}

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

const phraseCopy: Record<Locale, Record<string, string>> = {
  en: {},
  zh: {
    "Detected initializePool-style lifecycle": "检测到类似 initializePool 的生命周期",
    "Trading guarded by startTime/beforeSwap pattern": "交易受 startTime/beforeSwap 模式约束",
    "Project-side liquidity ranges seed price discovery": "项目方流动性区间负责启动价格发现",
    "No deposit/subscription flow": "未发现存入/认购流程",
    "No claim/refund settlement flow": "未发现领取/退款结算流程",
    "No visible bonding-curve accounting": "未发现明显的联合曲线记账",
    "$600K to reach ~$400M FDV": "约 $600K 可推至 ~$400M FDV",
    "~$1.08M buy-side depth": "买侧深度约 $1.08M",
    "~5T NEX": "约 5T NEX",
  },
};

const seedEventCopy: Record<Locale, Record<string, Pick<ChainEvent, "title" | "detail">>> = {
  en: {},
  zh: {
    "seed-1": {
      title: "检测到新的 Alpha hook 模式",
      detail: "池子生命周期使用了较新的 initializePool 路径，旧版加池监听可能漏掉它。",
    },
    "seed-2": {
      title: "池子已初始化，并带有定时交易门槛",
      detail: "机制更像定时 Alpha 池，而不是基于存入/领取的 TGE 认购。",
    },
    "seed-3": {
      title: "池子深度在接近 10 亿 FDV 前后受限",
      detail: "种子流动性显示，约 6 亿 FDV 后波动会升高，买侧在约 108 万 USDT 附近耗尽。",
    },
    "seed-4": {
      title: "Hyperlane 跨链供应需要监控",
      detail: "主供应在 Ethereum；种子调查中约 5T NEX 已跨到 BSC。",
    },
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

export function getPhraseCopy(locale: Locale, phrase: string) {
  return phraseCopy[locale][phrase] ?? phrase;
}

export function getEventCopy(locale: Locale, event: ChainEvent) {
  if (locale === "en") {
    return { title: event.title, detail: event.detail };
  }

  const seedCopy = seedEventCopy[locale][event.id];
  if (seedCopy) return seedCopy;

  if (event.id.startsWith("demo-")) {
    return {
      title: `演示检测心跳：${getSignalCopy(locale, event.signal)}`,
      detail: "设置 BSC_RPC_URL 或 ETH_RPC_URL 后，事件流会从种子演示切换为实时链上轮询。",
    };
  }

  if (event.signal === "Block") {
    return {
      title: `${event.chain.toUpperCase()} 区块 ${event.blockNumber ?? ""}`.trim(),
      detail: "实时 RPC 连接正常。",
    };
  }

  if (event.signal === "Transfer" || event.signal === "Log Match") {
    return {
      title: `${event.chain.toUpperCase()} 合约${event.signal === "Transfer" ? "触发被监控转账" : "产生日志命中"}`,
      detail: event.address
        ? `地址 ${event.address} 在日志索引中命中。`
        : "被监控地址产生日志命中。",
    };
  }

  if (event.signal === "Unknown Mechanism") {
    return {
      title: `${event.chain.toUpperCase()} 轮询异常`,
      detail: event.detail,
    };
  }

  return { title: event.title, detail: event.detail };
}
