import { AssistantChat } from "@/components/assistant/assistant-chat";

export default function EmbedCerebroPage() {
  return (
    <main aria-label="Cerebro assistant" className="h-dvh overflow-hidden p-2 sm:p-3">
      <AssistantChat
        mode="public_site"
        funnelSource="wp_cerebro_launcher"
        title="Cerebro"
        placeholder="Ask Cerebro about your ZIP, pricing, or how it works..."
        storage="session"
        fill
        disclosure="Cerebro is an AI assistant. Not a loan offer or commitment to lend."
        providerOfflineNotice="Cerebro is warming up - please use the contact form on ypnus.com and we will get right back to you."
      />
    </main>
  );
}
