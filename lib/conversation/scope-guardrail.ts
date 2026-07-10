const ADVICE_PATTERNS = [
  /should i (invest|buy|sell)/i,
  /which (stock|fund|mutual fund|scheme) (should|do you recommend)/i,
  /(best|good) (stock|fund|investment) (to|for)/i,
  /how (should|do) i invest/i,
];

export function isInvestmentAdviceRequest(text: string): boolean {
  return ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

export const SCOPE_REFUSAL_MESSAGE =
  "I'm not able to give investment advice or recommend specific stocks or funds — I can only help you book time with an advisor for that. " +
  "For general education, our Learn Hub has articles on how SIPs, mandates, and fund types work.";
