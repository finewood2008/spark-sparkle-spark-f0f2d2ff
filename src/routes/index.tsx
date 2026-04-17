import { createFileRoute } from "@tanstack/react-router";
import ChatLayout from "../components/ChatLayout";
import LandingPage from "../components/LandingPage";
import { useAuthStore } from "../store/authStore";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "火花 - 你的新媒体 AI 员工" },
      { name: "description", content: "火花：AI驱动的新媒体营销引擎，从选题到发布，全自动管理你的内容增长" },
      { property: "og:title", content: "火花 - 你的新媒体 AI 员工" },
      { property: "og:description", content: "从选题到发布，全自动管理你的内容增长" },
    ],
  }),
});

function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <ChatLayout /> : <LandingPage />;
}
