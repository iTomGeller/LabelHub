import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'LabelHub - 数据标注平台',
  description: 'LabelHub 标注生产流水线'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">
        {children}
      </body>
    </html>
  )
}
