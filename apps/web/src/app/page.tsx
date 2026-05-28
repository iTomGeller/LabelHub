'use client'
import Link from 'next/link'
import { tokens } from '@/lib/tokens'
import { AppShell } from '@/components/AppShell'

export default function HomePage() {
  const { colors } = tokens
  return (
    <AppShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: colors.text }}>数据生产总览</h1>
          <p className="text-sm mt-1" style={{ color: colors.textLight }}>LabelHub 数据标注平台全局状态</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: '进行中任务', value: '3', color: colors.primary },
            { label: '待审核数据', value: '230', color: colors.accent },
            { label: 'Agent 预审覆盖率', value: '83%', color: colors.success },
            { label: '退回率', value: '9%', color: colors.warning }
          ].map(m => (
            <div key={m.label} className="rounded-lg p-5 shadow-sm border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="text-sm" style={{ color: colors.textLight }}>{m.label}</div>
              <div className="text-3xl font-bold mt-2" style={{ color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4" style={{ color: colors.text }}>快速入口</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/tasks" className="p-5 rounded-lg border hover:shadow-md transition-all" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="font-bold" style={{ color: colors.primary }}>任务广场</div>
              <div className="text-sm mt-1" style={{ color: colors.textLight }}>浏览所有可领取标注任务</div>
            </Link>
            <Link href="/my-tasks" className="p-5 rounded-lg border hover:shadow-md transition-all" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="font-bold" style={{ color: colors.primary }}>我的工作台</div>
              <div className="text-sm mt-1" style={{ color: colors.textLight }}>查看我正在进行的任务和贡献统计</div>
            </Link>
            <Link href="/annotation/dynamic" className="p-5 rounded-lg border hover:shadow-md transition-all" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="font-bold" style={{ color: colors.primary }}>动态标注页</div>
              <div className="text-sm mt-1" style={{ color: colors.textLight }}>动态表单标注工作区</div>
            </Link>
            <Link href="/review/complete" className="p-5 rounded-lg border hover:shadow-md transition-all" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="font-bold" style={{ color: colors.primary }}>完整审核台</div>
              <div className="text-sm mt-1" style={{ color: colors.textLight }}>带 AgentPanel 和 TraceDrawer 的审核工作台</div>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
