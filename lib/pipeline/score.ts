import type { CleanFeedback, Cluster, TriageAction, CorpusKpis } from "../types";

/**
 * Rule-engine triage. This is the "PM methodology" heart of the product:
 * impact (share of voice) x negativity x momentum -> priority score -> action.
 *
 *   fix    : high impact + negative (users are hurting at scale)
 *   reply  : lower impact but negative/supportive tone (individual outreach)
 *   monitor: notable volume but neutral/mixed (keep watching)
 *   praise : predominantly positive (amplify / thank users)
 */
export function triage(
  items: CleanFeedback[],
  clusterOf: Map<string, number>,
  clusters: Omit<Cluster, "action" | "priority" | "share" | "negativity" | "avgRating" | "momentum">[],
  opts?: { recentWindowDays?: number },
): Cluster[] {
  const recentWindowDays = opts?.recentWindowDays ?? 30;
  const now = Date.now();
  const dated = items.filter((i) => i.date);
  const recentCut = now - recentWindowDays * 86400000;
  const recentCount = dated.filter(
    (i) => new Date(i.date + "T00:00:00").getTime() >= recentCut,
  ).length;

  const total = items.length || 1;

  return clusters.map((base) => {
    const members = items.filter((i) => clusterOf.get(i.id) === base.id);
    const share = members.length / total;
    const rated = members.filter((i) => typeof i.rating === "number");
    const negatives = members.filter((i) => isNegative(i)).length;
    const negativity = members.length ? negatives / members.length : 0;
    const avgRating =
      rated.length > 0
        ? rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length
        : undefined;

    // Momentum: cluster's share of recent feedback vs its overall share.
    const recentMembers = members.filter(
      (i) => i.date && new Date(i.date + "T00:00:00").getTime() >= recentCut,
    ).length;
    const clusterRecentShare =
      dated.length > 0 && recentCount > 0 ? recentMembers / recentCount : 0;
    const momentum = share > 0 ? clusterRecentShare - share : 0;

    const priority = Math.round(
      clamp(
        40 * share * Math.min(10, 1 / Math.max(share, 0.02)) * 0.35 + // impact term (diminishing)
          35 * negativity +
          15 * clamp(momentum * 4, -0.5, 1) +
          10 * (avgRating !== undefined ? (3 - Math.min(avgRating, 3)) / 2 : 0.3),
        0,
        100,
      ),
    );

    const action: TriageAction = decideAction({ share, negativity, members });

    return { ...base, share, negativity, avgRating, momentum, priority, action };
  });
}

function decideAction(input: {
  share: number;
  negativity: number;
  members: CleanFeedback[];
}): TriageAction {
  const { share, negativity, members } = input;

  // Praise requires a *pure-praise majority*: 4-star feature requests read
  // "positive" by rating, but they are roadmap input, not amplifiable praise —
  // counting only positive non-suggestion items keeps the praise bucket
  // genuinely quotable even when clustering mixes the two.
  const purePraise = members.filter((i) => isPositive(i) && !SUGGEST_PAT.test(i.text)).length;
  if (members.length > 0 && purePraise / members.length >= 0.5) return "praise";
  if (share >= 0.08 && negativity >= 0.5) return "fix";
  if (negativity >= 0.3) return "reply";
  return "monitor";
}

/** Rating-based sentiment when available; else keyword heuristic. */
export function isNegative(item: CleanFeedback): boolean {
  if (typeof item.rating === "number") return item.rating <= 2;
  return NEG_PAT.test(item.text) && !POS_PAT.test(item.text);
}

export function isPositive(item: CleanFeedback): boolean {
  if (typeof item.rating === "number") return item.rating >= 4;
  return POS_PAT.test(item.text) && !NEG_PAT.test(item.text);
}

const NEG_PAT =
  /(崩溃|闪退|卡死|太差|失望|垃圾|骗|退款|难用|bug| Bug |修复|扣费|乱扣|投诉|客服态度|用不了|打不开|登录不了|糟糕|恶心|坑|差评|一星|骗子|卸载)/i;
const POS_PAT =
  /(喜欢|好用|给力|推荐|五星|太棒|感谢|支持一下|越来越|惊艳|完美|流畅|良心|好评|nice|love|great|awesome|amazing|perfect|best)/i;
const SUGGEST_PAT = /(希望|建议|如果能|要不要|求|可以加|支持.{0,6}(功能|模式|视图)|自定义)/i;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function corpusKpis(items: CleanFeedback[]): CorpusKpis {
  const rated = items.filter((i) => typeof i.rating === "number");
  const lengths = items.map((i) => i.text.length).sort((a, b) => a - b);
  return {
    total: items.length,
    negativity: items.length ? items.filter(isNegative).length / items.length : 0,
    avgRating:
      rated.length > 0
        ? rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length
        : undefined,
    medianLength: lengths.length
      ? lengths[Math.floor(lengths.length / 2)]
      : 0,
    dated: items.filter((i) => i.date).length,
  };
}
