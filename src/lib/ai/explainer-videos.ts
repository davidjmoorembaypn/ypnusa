/**
 * Registry the assistant's find_explainer_video tool searches (see
 * chat-agent.ts). Empty by default — add an entry per video once you have a
 * real, hosted URL (YouTube/Vimeo/an uploaded file on ypnus.com or
 * app.ypnus.com). Never let the model invent a URL that isn't listed here:
 * the tool executor returns "no video yet" rather than guessing, and
 * PUBLIC_SITE_PROMPT/LEAD_QUALIFICATION_INTRO instruct the model the same way.
 *
 * `topics` are plain-English keywords/phrases matched case-insensitively
 * against the visitor's question (substring match, see findExplainerVideo
 * below) — list a few natural phrasings, not just the exact feature name.
 */
export interface ExplainerVideo {
  id: string;
  title: string;
  url: string;
  /** One sentence the assistant can paraphrase when offering the video. */
  description: string;
  /** Keywords/phrases that should surface this video for a matching question. */
  topics: string[];
}

export const EXPLAINER_VIDEOS: ExplainerVideo[] = [
  // {
  //   id: "territory-lock",
  //   title: "How ZIP territory locking works",
  //   url: "https://ypnus.com/wp-content/uploads/2026/09/territory-lock-explainer.mp4",
  //   description: "Walks through claiming a ZIP, what exclusivity actually locks, and what happens if someone else tries to claim it after you.",
  //   topics: ["territory", "zip", "exclusive", "lock", "claim a zip"],
  // },
];

/**
 * Case-insensitive substring match against each video's topics. Returns the
 * best match (most topic hits) or null when nothing in the registry applies —
 * callers must handle null by saying so, never by fabricating a link.
 */
export function findExplainerVideo(query: string): ExplainerVideo | null {
  const q = query.toLowerCase();
  let best: { video: ExplainerVideo; hits: number } | null = null;

  for (const video of EXPLAINER_VIDEOS) {
    const hits = video.topics.filter((topic) => q.includes(topic.toLowerCase())).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { video, hits };
    }
  }

  return best?.video ?? null;
}
