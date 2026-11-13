import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo · 用户之声智能归因台",
  description:
    "把几百条散落的用户反馈，3 分钟变成一份带行动建议的用户之声周报。浏览器内计算，数据不出本机。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
