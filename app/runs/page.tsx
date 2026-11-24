import type { Metadata } from "next";
import RunsClient from "./RunsClient";

export const metadata: Metadata = {
  title: "分析记录 · Echo 用户之声",
  description: "管理本地分析记录：重命名、导出、删除",
};

export default function RunsPage() {
  return <RunsClient />;
}
