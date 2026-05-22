import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabelHub",
  description: "AI data annotation production console"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
