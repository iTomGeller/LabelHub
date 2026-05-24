import { AppShell, type ViewKey } from "@/components/AppShell";
import { TaskList } from "@/components/TaskList";
import { TaskStepper } from "@/components/TaskStepper";
import { TaskDetail } from "@/components/TaskDetail";
import { AgentTraceView } from "@/components/AgentTraceView";
import { SettingsView } from "@/components/SettingsView";
import { AiDrawer } from "@/components/AiDrawer";

const views: ViewKey[] = ["list", "task", "detail", "trace", "settings"];

export default function Home({ searchParams }: { searchParams?: { view?: string; taskId?: string; step?: string; traceId?: string } }) {
  const activeView = parseView(searchParams?.view);
  const taskId = searchParams?.taskId;
  const initialStep = searchParams?.step;
  const traceId = searchParams?.traceId;

  return (
    <AppShell activeView={activeView}>
      {renderView(activeView, taskId, initialStep, traceId)}
      <AiDrawer />
    </AppShell>
  );
}

function parseView(view: string | undefined): ViewKey {
  return views.includes(view as ViewKey) ? (view as ViewKey) : "list";
}

function renderView(activeView: ViewKey, taskId?: string, initialStep?: string, traceId?: string) {
  switch (activeView) {
    case "list":
      return <TaskList />;
    case "task":
      return <TaskStepper taskId={taskId} initialStep={initialStep} />;
    case "detail":
      return <TaskDetail taskId={taskId} />;
    case "trace":
      return <AgentTraceView traceId={traceId} />;
    case "settings":
      return <SettingsView />;
  }
}
