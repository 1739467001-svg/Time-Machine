import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "时光机 · Time Machine",
  description: "拍一张照片，用 AI 推演 10 至 60 年后的自己。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
