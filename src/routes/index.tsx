import { createFileRoute } from "@tanstack/react-router";
import IconNav from "../components/IconNav";
import AICommandPanel from "../components/AICommandPanel";
import EditorCanvas from "../components/EditorCanvas";
import PreviewPanel from "../components/PreviewPanel";
import DashboardPage from "../pages/DashboardPage";
import MemoryPage from "../pages/MemoryPage";
import SettingsPage from "../pages/SettingsPage";
import SchedulePage from "../pages/SchedulePage";
import { useAppStore } from "../store/appStore";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "火花自动版 - AI社媒图文自动化工具" },
      { name: "description", content: "火花自动版：AI驱动的社交媒体内容创作与自动化平台" },
    ],
  }),
});

function Index() {
  const { activeTab } = useAppStore();

  // Studio tab gets the special 3-column layout
  if (activeTab === 'studio') {
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <IconNav />
        <AICommandPanel />
        <EditorCanvas />
        <PreviewPanel />
      </div>
    );
  }

  // Other tabs get icon nav + full page
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <IconNav />
      <main className="flex-1 min-w-0 overflow-hidden">
        {activeTab === 'schedule' && <SchedulePage />}
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'memory' && <MemoryPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
