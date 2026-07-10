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
    prompt:
      "Classify the caller's utterance into exactly one intent: book_new, reschedule, cancel, " +
      "what_to_prepare, or check_availability.\n\n" +
      `Utterance: "${utterance}"`,
  });

  return object.intent;
}
