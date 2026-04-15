import { createFileRoute } from "@tanstack/react-router";
import ChatLayout from "../components/ChatLayout";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "火花 - 你的内容创作搭子" },
      { name: "description", content: "火花：AI驱动的内容创作数字员工，对话式创作体验" },
    ],
  }),
});

function Index() {
  return <ChatLayout />;
}
