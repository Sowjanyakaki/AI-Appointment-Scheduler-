import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

export const IntentSchema = z.object({
  intent: z.enum(["book_new", "reschedule", "cancel", "what_to_prepare", "check_availability"]),
});

export type Intent = z.infer<typeof IntentSchema>["intent"];

export async function classifyIntent(utterance: string): Promise<Intent> {
  const { object } = await generateObject({
    model: groq("llama-3.3-70b-versatile"),
    schema: IntentSchema,
    // llama-3.3-70b-versatile doesn't support Groq's json_schema response
    // format; fall back to plain JSON mode, which it does support.
    providerOptions: { groq: { structuredOutputs: false } },
    prompt:
      "Classify the caller's utterance into exactly one intent: book_new, reschedule, cancel, " +
      "what_to_prepare, or check_availability. Respond with JSON only, matching this shape: " +
      '{"intent": "<one of the five values above>"}.\n\n' +
      `Utterance: "${utterance}"`,
  });

  return object.intent;
}
