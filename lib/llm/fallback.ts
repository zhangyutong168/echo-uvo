import type { CleanFeedback, Cluster, WeeklyReport } from "../types";

/**
 * Fallback naming: deterministic keyword-based titles when no LLM key is
 * configured. Produces readable titles like "闪退 · 崩溃 (23 条)" so the
 * full product flow still works with zero API keys.
 */

const TITLE_HINTS: Array<[RegExp, string]> = [
  [/(闪退|崩溃|crash|强制关闭)/i, "闪退与崩溃"],
  [/(卡|慢|加载|延迟|lag|slow|freeze)/i, "卡顿与性能"],
  [/(登录|账号|注册|密码|验证码|login|sign ?in|account)/i, "登录与账号"],
  [/(扣费|付费|退款|价格|收费|订阅|price|refund|billing)/i, "计费与付费"],
  [/(客服|反馈|回复|工单|support|service)/i, "客服与支持"],
  [/(广告|推送|打扰|ads|notification|spam)/i, "广告与推送"],
  [/(更新|版本|升级|update|version)/i, "更新与版本"],
  [/(界面|ui|设计|好看|丑|design|ui)/i, "界面与设计"],
  [/(功能|希望|建议|期待|feature|suggest)/i, "功能建议"],
  [/(喜欢|好评|五星|棒|love|great|awesome)/i, "好评与推荐"],
  [/(电池|耗电|发热|battery|heat)/i, "耗电与发热"],
  [/(数据|同步|丢失|backup|sync|lost)/i, "数据与同步"],
];

export function fallbackTitle(cluster: Cluster, members: CleanFeedback[]): string {
  const counts = new Map<string, number>();
  for (const [pat, label] of TITLE_HINTS) {
    for (const m of members) {
      if (pat.test(m.text)) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const label = top ? top[0] : cluster.keywords.slice(0, 2).join(" · ") || "其他反馈";
  return `${label}（${members.length} 条）`;
}

export function fallbackSummary(cluster: Cluster): string {
  const kw = cluster.keywords.slice(0, 4).join("、");
  const pct = Math.round(cluster.share * 100);
  const neg = Math.round(cluster.negativity * 100);
  const trend =
    cluster.momentum > 0.03 ? "且近期占比上升" : cluster.momentum < -0.03 ? "近期热度回落" : "热度平稳";
  return `约 ${pct}% 的反馈集中在此主题，关键词：${kw}。负面占比 ${neg}%，${trend}。`;
}

/** Template-based weekly report (no LLM required). */
export function templateReport(
  clusters: Cluster[],
  membersOf: (c: Cluster) => CleanFeedback[],
): WeeklyReport {
  const pick = (c: Cluster) => membersOf(c).slice(0, 2).map((m) => `“${m.text.slice(0, 60)}”`);
  const fix = clusters.filter((c) => c.action === "fix");
  const reply = clusters.filter((c) => c.action === "reply");
  const monitor = clusters.filter((c) => c.action === "monitor");
  const praise = clusters.filter((c) => c.action === "praise");

  const headline = fix.length > 0
    ? `「${fix[0] ? clusterLabel(fix[0]) : ""}」是当前最需要处理的用户痛点`
    : praise.length > 0
      ? `整体口碑健康，「${praise[0] ? clusterLabel(praise[0]) : ""}」值得放大`
      : "用户反馈整体平稳，无紧急事项";

  return {
    mode: "template",
    headline,
    toFix: fix.map((c) => `**${clusterLabel(c)}**（占比 ${pct(c.share)}，负面 ${pct(c.negativity)}）：${c.summary ?? ""} 建议本周内排期修复。典型反馈：${pick(c).join(" ")}`),
    toReply: reply.map((c) => `**${clusterLabel(c)}**（占比 ${pct(c.share)}）：逐条回复 ${Math.min(c.memberIds.length, 20)} 条用户反馈，优先评分≤2 星的用户。`),
    toMonitor: monitor.map((c) => `**${clusterLabel(c)}**（占比 ${pct(c.share)}）：声量${c.momentum > 0.03 ? "上升，纳入观察" : "平稳，保持关注"}。`),
    praises: praise.map((c) => `**${clusterLabel(c)}**（占比 ${pct(c.share)}）：可截取好评用于商店回复与素材传播。典型反馈：${pick(c).join(" ")}`),
    createdAt: Date.now(),
  };
}

function clusterLabel(c: Cluster): string {
  return (c.title ?? c.keywords.slice(0, 3).join(" · ")).replace(/（\d+ 条）$/, "");
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
