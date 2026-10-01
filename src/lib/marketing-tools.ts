import { getAiProvider } from "@/lib/ai/provider";

export type MarketingTool = "gbp" | "social";

export interface MarketingToolInput {
  tool: MarketingTool;
  profession: "mortgage" | "real_estate";
  businessName: string;
  market: string;
  services: string;
  audience?: string;
  tone?: string;
  platform?: string;
  topic?: string;
  currentProfile?: string;
}

function clean(value: unknown, max = 1200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseMarketingToolInput(body: unknown): MarketingToolInput {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const tool = raw.tool === "social" ? "social" : "gbp";
  const profession = raw.profession === "real_estate" ? "real_estate" : "mortgage";
  const businessName = clean(raw.businessName, 120);
  const market = clean(raw.market, 120);
  const services = clean(raw.services, 600);
  if (!businessName || !market || !services) throw new Error("Business name, market, and services are required.");
  return {
    tool, profession, businessName, market, services,
    audience: clean(raw.audience, 300), tone: clean(raw.tone, 80),
    platform: clean(raw.platform, 80), topic: clean(raw.topic, 300),
    currentProfile: clean(raw.currentProfile, 1800),
  };
}

export function buildMarketingToolPrompt(input: MarketingToolInput): string {
  const role = input.profession === "mortgage" ? "mortgage loan officer or mortgage company" : "real estate agent or real estate team";
  if (input.tool === "gbp") {
    return `You are YPN USA's Google Business Profile optimization assistant. Create an actionable audit and optimization draft for a ${role}. Never claim you accessed, verified, edited, ranked, or published a Google Business Profile. Work only from the user's supplied information. Avoid keyword stuffing, fake reviews, fabricated facts, guaranteed rankings, or invented business attributes.

Business: ${input.businessName}
Market: ${input.market}
Services: ${input.services}
Current profile notes: ${input.currentProfile || "Not supplied"}

Return concise plain text with exactly these headings:
SCORE
TOP FIXES
PRIMARY CATEGORY DIRECTION
BUSINESS DESCRIPTION DRAFT
SERVICES TO EMPHASIZE
3 GOOGLE POST IDEAS
REVIEW RESPONSE GUIDANCE
LOCAL SEO NEXT ACTIONS
Under SCORE give a 0-100 readiness score based only on completeness of supplied information and clearly label it an estimated readiness score, not a Google ranking score.`;
  }
  return `You are YPN USA's social media marketing writer for a ${role}. Draft useful, specific marketing content from supplied facts only. Do not invent rates, listings, closings, testimonials, credentials, market statistics, guarantees, or regulatory claims. Mortgage content must avoid promises of approval, savings, rates, or outcomes and should prompt compliance review before publishing.

Business: ${input.businessName}
Market: ${input.market}
Services: ${input.services}
Audience: ${input.audience || "local prospects and referral partners"}
Platform: ${input.platform || "Instagram, Facebook, and LinkedIn"}
Tone: ${input.tone || "clear, professional, local, helpful"}
Topic/offer: ${input.topic || "educational local-market content"}

Return concise plain text with exactly these headings:
CONTENT ANGLE
5 POST DRAFTS
5 HOOKS
CTA OPTIONS
HASHTAG / TOPIC IDEAS
COMPLIANCE CHECK
30-DAY FOLLOW-UP IDEAS
Make each post distinct and ready to edit, but label the output as draft marketing copy.`;
}

export async function generateMarketingTool(input: MarketingToolInput): Promise<string> {
  const provider = getAiProvider();
  if (!provider) throw new Error("AI_PROVIDER_NOT_CONFIGURED");
  const result = await provider.generate({
    system: "You produce practical marketing drafts for YPN USA tools. Follow the requested headings and factual constraints exactly.",
    messages: [{ role: "user", content: buildMarketingToolPrompt(input) }],
    maxTokens: 2200,
  });
  return result.text.trim();
}
