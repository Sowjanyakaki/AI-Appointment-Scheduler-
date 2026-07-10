export const TOPICS = [
  "KYC/Onboarding",
  "SIP/Mandates",
  "Statements/Tax Docs",
  "Withdrawals & Timelines",
  "Account Changes/Nominee",
] as const;

export type Topic = (typeof TOPICS)[number];

const TOPIC_KEYWORDS: Record<Topic, RegExp> = {
  "KYC/Onboarding": /\bkyc\b|onboard/i,
  "SIP/Mandates": /\bsip\b|mandate/i,
  "Statements/Tax Docs": /statement|tax doc|\bitr\b/i,
  "Withdrawals & Timelines": /withdraw|redemption timeline/i,
  "Account Changes/Nominee": /nominee|account change/i,
};

export function matchTopic(text: string): Topic | null {
  for (const topic of TOPICS) {
    if (TOPIC_KEYWORDS[topic].test(text)) return topic;
  }
  return null;
}
