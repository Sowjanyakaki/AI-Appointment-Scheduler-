const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/;
const ACCOUNT_RE = /\b\d{9,18}\b/;

export function containsPII(text: string): boolean {
  return PHONE_RE.test(text) || EMAIL_RE.test(text) || ACCOUNT_RE.test(text);
}
