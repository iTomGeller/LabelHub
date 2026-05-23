import { AppShell, type ViewKey } from "@/components/AppShell";
import { TaskList } from "@/components/TaskList";
import { TaskStepper } from "@/components/TaskStepper";
import { SettingsView } from "@/components/SettingsView";
import { AiDrawer } from "@/components/AiDrawer";

const views: ViewKey[] = ["list", "task", "settings"];

export default function Home({ searchParams }: { searchParams?: { view?: string; taskId?: string } }) {
  const activeView = parseView(searchParams?.view);
  const taskId = searchParams?.taskId;

  return (
    <AppShell activeView={activeView}>
      {renderView(activeView, taskId)}
      <AiDrawer />
    </AppShell>
  );
}

function parseView(view: string | undefined): ViewKey {
  return views.includes(view as ViewKey) ? (view as ViewKey) : "list";
}

function renderView(activeView: ViewKey, taskId?: string) {
  switch (activeView) {
    case "list":
      return <TaskList />;
    case "task":
      return <TaskStepper taskId={taskId} />;
    case "settings":
      return <SettingsView />;
  }
}
