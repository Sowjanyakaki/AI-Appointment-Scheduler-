import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdin: PassThrough;
      stdout: PassThrough;
    };
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();

    process.nextTick(() => {
      child.stdout.end(Buffer.from("RIFF-fake-wav-bytes"));
      child.emit("close", 0);
    });

    return child;
  }),
}));

import { synthesizeSpeech } from "./synthesize";

describe("synthesizeSpeech", () => {
  it("pipes text to piper and returns the wav buffer", async () => {
    const result = await synthesizeSpeech("You're booked for Tuesday at 9 AM IST.");
    expect(result.toString()).toContain("RIFF-fake-wav-bytes");
  });
});
