import { AppShell, type ViewKey } from "@/components/AppShell";
import { TaskList } from "@/components/TaskList";
import { TaskStepper } from "@/components/TaskStepper";
import { SettingsView } from "@/components/SettingsView";
import { AiDrawer } from "@/components/AiDrawer";

const views: ViewKey[] = ["list", "task", "settings"];

export default function Home({ searchParams }: { searchParams?: { view?: string } }) {
  const activeView = parseView(searchParams?.view);

  return (
    <AppShell activeView={activeView}>
      {renderView(activeView)}
      <AiDrawer />
    </AppShell>
  );
}

function parseView(view: string | undefined): ViewKey {
  return views.includes(view as ViewKey) ? (view as ViewKey) : "task";
}

function renderView(activeView: ViewKey) {
  switch (activeView) {
    case "list":
      return <TaskList />;
    case "task":
      return <TaskStepper />;
    case "settings":
      return <SettingsView />;
  }
}
