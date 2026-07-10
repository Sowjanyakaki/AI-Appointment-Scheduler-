import { spawn } from "node:child_process";

export function synthesizeSpeech(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const piperBin = process.env.PIPER_BIN ?? "./bin/piper";
    const piperModel = process.env.PIPER_MODEL ?? "./bin/en_US-lessac-medium.onnx";

    const child = spawn(piperBin, ["--model", piperModel, "--output_file", "-"]);
    const chunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`piper exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    child.stdin.write(text);
    child.stdin.end();
  });
}
