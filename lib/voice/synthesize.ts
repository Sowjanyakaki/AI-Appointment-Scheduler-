import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function synthesizeSpeech(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const piperBin = path.resolve(process.env.PIPER_BIN ?? "./bin/piper");
    const piperModel = path.resolve(process.env.PIPER_MODEL ?? "./bin/en_US-lessac-medium.onnx");


    const espeakData = path.join(path.dirname(piperBin), "espeak-ng-data");
    const args = ["--model", piperModel, "--output_file", "-"];
    if (fs.existsSync(espeakData)) {
      args.push("--espeak_data", espeakData);
    }

    const child = spawn(piperBin, args);
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
