import { AssistantChat } from "@/components/assistant/assistant-chat";

export default function EmbedCerebroPage() {
  return (
    <main
      aria-label="Cerebro AI growth diagnostic embed"
      className="flex min-h-[600px] flex-col justify-center px-3 py-4 md:min-h-[min(100dvh,720px)] md:px-4 md:py-6"
    >
      <AssistantChat
        mode="public_site"
        title="Cerebro"
        placeholder="Type your ZIP or biggest challenge…"
        funnelSource="cerebro_homepage_embed"
      />
    </main>
  );
}
