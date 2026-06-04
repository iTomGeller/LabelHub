import type { Metadata } from "next";
import "./globals.css";
import { ProtectedLayout } from "@/components/ProtectedLayout";

export const metadata: Metadata = {
  title: "LabelHub",
  description: "AI data annotation production console"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ProtectedLayout>
          {children}
        </ProtectedLayout>
      </body>
    </html>
  );
}
