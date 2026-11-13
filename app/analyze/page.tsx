import AnalyzeClient from "./AnalyzeClient";

export const metadata = {
  title: "新建分析 · Echo 用户之声",
  description: "上传 CSV 或使用演示数据，3 分钟生成用户之声归因报告",
};

export default function AnalyzePage() {
  return <AnalyzeClient />;
}
