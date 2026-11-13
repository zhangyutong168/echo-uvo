// Bilingual sample feedback set for instant demo (no signup, no data needed).
// Simulated but realistic: mixed praise / pain points / feature requests,
// spanning ~8 weeks so trend lines and momentum are meaningful.
// Clearly labeled as simulated in the UI.

interface Seed {
  text: string;
  rating: number;
  daysAgo: number;
  author: string;
  /** Ground-truth topic for the clustering eval (eval/cluster-eval.ts). */
  topic: Topic;
}

export type Topic =
  | "崩溃与闪退"
  | "加载慢与卡顿"
  | "登录与账号"
  | "计费与付费"
  | "客服与支持"
  | "功能建议"
  | "好评"
  | "广告与推送";

const SEEDS: Seed[] = [
  // ---- 崩溃与闪退 (negative, high volume, rising) ----
  { text: "最近版本老是闪退，看到一半直接崩了，数据都没保存", rating: 1, daysAgo: 2, author: "用户A", topic: "崩溃与闪退" },
  { text: "更新之后频繁崩溃，客服电话也打不通", rating: 1, daysAgo: 3, author: "用户B", topic: "崩溃与闪退" },
  { text: "打开就闪退，重启几次才行，太影响使用了", rating: 1, daysAgo: 4, author: "用户C", topic: "崩溃与闪退" },
  { text: "安卓 14 上必现崩溃，希望尽快修复", rating: 1, daysAgo: 5, author: "用户D", topic: "崩溃与闪退" },
  { text: "用着用着就崩溃了，一晚上三次", rating: 1, daysAgo: 6, author: "用户E", topic: "崩溃与闪退" },
  { text: "闪退闪退闪退，重要报告差点丢失", rating: 1, daysAgo: 7, author: "用户F", topic: "崩溃与闪退" },
  { text: "崩溃问题从上个版本就有了，一直没修", rating: 2, daysAgo: 9, author: "用户G", topic: "崩溃与闪退" },
  { text: "昨晚又崩溃两次，体验极差", rating: 1, daysAgo: 10, author: "用户H", topic: "崩溃与闪退" },
  { text: "崩溃导致登录状态丢失，每次都要重新登录", rating: 2, daysAgo: 11, author: "用户I", topic: "崩溃与闪退" },
  { text: "新版崩溃率明显变高，同事们都反映同样问题", rating: 1, daysAgo: 12, author: "用户J", topic: "崩溃与闪退" },
  { text: "崩溃以后草稿全没了，这个必须修啊", rating: 1, daysAgo: 13, author: "用户K", topic: "崩溃与闪退" },
  { text: "连续一周每天崩溃，快用不下去了", rating: 1, daysAgo: 14, author: "用户L", topic: "崩溃与闪退" },
  { text: "昨晚刚更新的，今天崩溃了四次", rating: 1, daysAgo: 1, author: "用户M", topic: "崩溃与闪退" },
  { text: "崩溃日志已经发客服邮箱三天了没有任何回复", rating: 1, daysAgo: 1, author: "用户N", topic: "崩溃与闪退" },
  { text: "打开某个页面必崩，希望工程师看看", rating: 2, daysAgo: 2, author: "用户O", topic: "崩溃与闪退" },

  // ---- 加载慢/卡顿 (negative, medium volume) ----
  { text: "加载太慢了，首页要转五六秒才出来", rating: 2, daysAgo: 3, author: "用户P", topic: "加载慢与卡顿" },
  { text: "卡顿严重，滑动列表掉帧明显", rating: 2, daysAgo: 5, author: "用户Q", topic: "加载慢与卡顿" },
  { text: "低端机上卡得没法用，希望优化性能", rating: 2, daysAgo: 8, author: "用户R", topic: "加载慢与卡顿" },
  { text: "图片加载特别慢，流量还消耗大", rating: 3, daysAgo: 12, author: "用户S", topic: "加载慢与卡顿" },
  { text: "启动速度比竞品慢很多，急死人了", rating: 2, daysAgo: 15, author: "用户T", topic: "加载慢与卡顿" },
  { text: "搜索响应很慢，输入之后要等两三秒", rating: 3, daysAgo: 18, author: "用户U", topic: "加载慢与卡顿" },
  { text: "老机型卡顿明显，不过新手机还行", rating: 3, daysAgo: 22, author: "用户V", topic: "加载慢与卡顿" },
  { text: "卡顿问题最近有改善，但加载还是慢", rating: 3, daysAgo: 25, author: "用户W", topic: "加载慢与卡顿" },

  // ---- 登录与账号 (negative, medium, rising) ----
  { text: "验证码一直收不到，根本登录不了", rating: 1, daysAgo: 2, author: "用户X", topic: "登录与账号" },
  { text: "第三方登录一直报错，绑定也解不开", rating: 1, daysAgo: 3, author: "用户Y", topic: "登录与账号" },
  { text: "改密码之后所有设备都登录不了", rating: 2, daysAgo: 6, author: "用户Z", topic: "登录与账号" },
  { text: "登录态老是掉，一天要登三次", rating: 2, daysAgo: 9, author: "用户AA", topic: "登录与账号" },
  { text: "手机号换绑流程太复杂，客服也说不清", rating: 2, daysAgo: 16, author: "用户AB", topic: "登录与账号" },
  { text: "注册收不到验证邮件，垃圾箱也没有", rating: 1, daysAgo: 17, author: "用户AC", topic: "登录与账号" },
  { text: "微信登录偶尔失败，重试又好了", rating: 3, daysAgo: 20, author: "用户AD", topic: "登录与账号" },

  // ---- 计费与付费 (negative, low volume, high severity) ----
  { text: "订阅到期后还在扣费，要求退款", rating: 1, daysAgo: 4, author: "用户AE", topic: "计费与付费" },
  { text: "自动续费没有提前通知，乱扣费", rating: 1, daysAgo: 7, author: "用户AF", topic: "计费与付费" },
  { text: "充值没到账，客服拖了两天才处理", rating: 1, daysAgo: 11, author: "用户AG", topic: "计费与付费" },
  { text: "价格比同类产品贵，功能却更少", rating: 2, daysAgo: 14, author: "用户AH", topic: "计费与付费" },
  { text: "免费版限制太多，付费又太贵", rating: 3, daysAgo: 21, author: "用户AI", topic: "计费与付费" },

  // ---- 客服与支持 (negative, small) ----
  { text: "客服态度很差，问题没解决就挂电话", rating: 1, daysAgo: 5, author: "用户AJ", topic: "客服与支持" },
  { text: "工单提交一周了无人回复", rating: 1, daysAgo: 10, author: "用户AK", topic: "客服与支持" },
  { text: "在线客服机器人答非所问，转人工要等半小时", rating: 2, daysAgo: 13, author: "用户AL", topic: "客服与支持" },

  // ---- 功能建议 (neutral/mixed, medium) ----
  { text: "希望增加深色模式，晚上用太刺眼了", rating: 4, daysAgo: 6, author: "用户AM", topic: "功能建议" },
  { text: "建议支持多端同步，手机和电脑切换太麻烦", rating: 4, daysAgo: 8, author: "用户AN", topic: "功能建议" },
  { text: "如果能加个日历视图就完美了", rating: 4, daysAgo: 12, author: "用户AO", topic: "功能建议" },
  { text: "希望支持导出 PDF，汇报的时候要用", rating: 4, daysAgo: 15, author: "用户AP", topic: "功能建议" },
  { text: "建议增加团队协作功能，现在只能单人用", rating: 4, daysAgo: 19, author: "用户AQ", topic: "功能建议" },
  { text: "希望能自定义首页布局", rating: 4, daysAgo: 23, author: "用户AR", topic: "功能建议" },

  // ---- 好评 (positive, high volume) ----
  { text: "用了两年了，越来越好用，界面也清爽", rating: 5, daysAgo: 4, author: "用户AS", topic: "好评" },
  { text: "新版本的搜索快多了，好评", rating: 5, daysAgo: 5, author: "用户AT", topic: "好评" },
  { text: "功能很全，家人都在用，推荐", rating: 5, daysAgo: 9, author: "用户AU", topic: "好评" },
  { text: "设计很用心，细节体验满分", rating: 5, daysAgo: 13, author: "用户AV", topic: "好评" },
  { text: "同步速度很快，跨设备无缝，五星", rating: 5, daysAgo: 16, author: "用户AW", topic: "好评" },
  { text: "客服小姐姐很耐心地帮我解决了问题，点赞", rating: 5, daysAgo: 18, author: "用户AX", topic: "好评" },
  { text: "免费功能已经够用，良心软件", rating: 5, daysAgo: 21, author: "用户AY", topic: "好评" },
  { text: "推荐给整个部门用了，大家反馈都很好", rating: 5, daysAgo: 24, author: "用户AZ", topic: "好评" },
  { text: "稳定流畅，从没出过问题", rating: 5, daysAgo: 27, author: "用户BA", topic: "好评" },

  // ---- 广告与推送 (mixed, small but rising) ----
  { text: "推送太多了，一天十几条，关不掉", rating: 2, daysAgo: 2, author: "用户BB", topic: "广告与推送" },
  { text: "开屏广告时间变长了，体验下降", rating: 3, daysAgo: 4, author: "用户BC", topic: "广告与推送" },
  { text: "希望推送可以按类别订阅，现在太吵", rating: 3, daysAgo: 7, author: "用户BD", topic: "广告与推送" },
  { text: "广告位置越来越深，容易误触", rating: 2, daysAgo: 10, author: "用户BE", topic: "广告与推送" },
];

import { toIsoDate } from "../pipeline/clean";
import { cleanRows } from "../pipeline/clean";
import type { CleanFeedback, RawFeedback } from "../types";

/** Build the demo dataset as cleaned feedback items with dates relative to today. */
export function sampleDataset(): CleanFeedback[] {
  const now = Date.now();
  const raw: RawFeedback[] = SEEDS.map((s, i) => ({
    id: `s${i}`,
    text: s.text,
    rating: s.rating,
    date: toIsoDate(new Date(now - s.daysAgo * 86400000).toISOString().slice(0, 10)),
    author: s.author,
  }));
  return cleanRows(raw).items;
}

/** Count for display (no date computation, prerender-safe). */
export function sampleDatasetCount(): number {
  return SEEDS.length;
}

export const SAMPLE_NAME = "内置演示数据（仿真）";

/** Seeds with ground-truth topics, for the clustering eval only. */
export function sampleSeedsWithTopics(): (Seed & { id: string })[] {
  return SEEDS.map((s, i) => ({ ...s, id: `s${i}` }));
}
