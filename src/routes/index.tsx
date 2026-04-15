import { createFileRoute } from "@tanstack/react-router";
import SparkSidebar from "../components/SparkSidebar";
import SparkAssistant from "../components/SparkAssistant";
import StudioPage from "../pages/StudioPage";
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

  const renderPage = () => {
    switch (activeTab) {
      case 'studio': return <StudioPage />;
      case 'schedule': return <SchedulePage />;
      case 'dashboard': return <DashboardPage />;
      case 'memory': return <MemoryPage />;
      case 'settings': return <SettingsPage />;
      default: return <StudioPage />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <SparkSidebar />
      <main className="flex-1 min-w-0 overflow-hidden">
        {renderPage()}
      </main>
      <SparkAssistant />
    </div>
  );
}
