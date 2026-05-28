#!/usr/bin/env node
/**
 * UI drawer smoke test (requires: npx playwright install chromium)
 * Run: node scripts/ui_drawer_verify.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://8.146.231.216";
const TASK_ID = "task_text_cls_001";

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("SKIP playwright not installed");
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  try {
    await page.goto(`${BASE}/?view=task&taskId=${TASK_ID}&step=publish`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForSelector("text=AI 质量审核", { timeout: 60000 }).catch(() => {
      errors.push("publish page missing AI 质量审核");
    });

    const dagBtn = page.locator("button").filter({ hasText: "任务说明" }).first();
    if (await dagBtn.count()) {
      await dagBtn.click();
      await page.waitForSelector('[data-testid="business-conclusion-drawer"]', { timeout: 10000 });
      const drawer = await page.locator('[data-testid="business-conclusion-drawer"]').innerText();
      for (const m of ["业务结论", "影响范围", "下一步", "依据摘要"]) {
        if (!drawer.includes(m)) errors.push(`business drawer missing ${m}`);
      }
      for (const bad of ["Prompt 输入", "exitCode", "knowledge_base"]) {
        if (drawer.includes(bad)) errors.push(`business drawer exposes ${bad}`);
      }
    } else {
      errors.push("no business DAG node button found");
    }

    const traceResp = await page.request.get(`${BASE}/agent-api/agents/audit-runs/recent?limit=1`);
    const runs = await traceResp.json();
    const traceId = runs[0]?.trace_id;
    if (!traceId) {
      errors.push("no recent trace");
    } else {
      await page.goto(`${BASE}/?view=trace&traceId=${encodeURIComponent(traceId)}`, { waitUntil: "networkidle", timeout: 90000 });
      const agentBtn = page.locator("button").filter({ hasText: "任务说明构建" }).first();
      if (await agentBtn.count()) {
        await agentBtn.click();
        await page.waitForSelector('[data-testid="agent-trace-drawer"]', { timeout: 10000 });
        const devDrawer = await page.locator('[data-testid="agent-trace-drawer"]').innerText();
        for (const m of ["Agent 排障抽屉", "Prompt 输入", "决策轮次", "调用证据", "输入", "输出", "结果影响"]) {
          if (!devDrawer.includes(m)) errors.push(`agent drawer missing ${m}`);
        }
        const bottomCanvas = await page.locator('[data-testid="agent-workflow-inline"]').count();
        if (bottomCanvas > 0) errors.push("inline workflow canvas should not appear below DAG");
      } else {
        errors.push("no agent DAG card found");
      }
    }
  } finally {
    await browser.close();
  }

  if (errors.length) {
    console.error("FAIL", errors.join("; "));
    process.exit(1);
  }
  console.log("OK ui drawer smoke");
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
