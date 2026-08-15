import { readFileSync } from "node:fs";
import { decode } from "jpeg-js";
import { describe, expect, it } from "vitest";
import { createOnnxSession, verifySha256, type ResolvedModelConfig } from "./onnxSession.ts";
import { preprocessToTensor, resizeBilinear, softmax, topk } from "./preprocessing.ts";
import { MockRuntime } from "./mock.ts";

const modelBytes = readFileSync(new URL("../../../models/mobilenetv2-12-int8.onnx", import.meta.url));
const labels = readFileSync(new URL("../../../models/synset.txt", import.meta.url), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(line.indexOf(" ") + 1));

const modelConfig: ResolvedModelConfig = {
  name: "mobilenet-v2-int8",
  modelUrl: "file:///models/mobilenetv2-12-int8.onnx",
  modelBytes: modelBytes.buffer.slice(modelBytes.byteOffset, modelBytes.byteOffset + modelBytes.byteLength),
  sha256: "cc028fe6cae7bc11a4ff53cfc9b79c920e8be65ce33a904ec3e2a8f66d77f95f",
  labels,
  preprocessing: { width: 224, height: 224, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
  backend: "wasm",
};

const decodeFixture = (): ImageData => {
  const jpeg = decode(readFileSync(new URL("../../../models/fixtures/cat.jpg", import.meta.url)));
  return { data: jpeg.data, width: jpeg.width, height: jpeg.height } as unknown as ImageData;
};

describe("preprocessing", () => {
  it("resizes preserving aspect ratio", () => {
    const input = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const out = resizeBilinear(input, 4, 4, 2, 2);
    expect(out).toHaveLength(2 * 2 * 4);
    expect(out[0]).toBe(255);
  });

  it("produces a normalized NCHW tensor with the expected shape", () => {
    const image = new Uint8ClampedArray(2 * 2 * 4).fill(0);
    image[0] = 255;
    const tensor = preprocessToTensor(image, 2, 2, modelConfig.preprocessing);
    expect(tensor).toHaveLength(1 * 3 * 224 * 224);
    const red = tensor[0];
    const green = tensor[224 * 224];
    const blue = tensor[2 * 224 * 224];
    expect(red).toBeCloseTo((1 - 0.485) / 0.229, 5);
    expect(green).toBeCloseTo((0 - 0.456) / 0.224, 5);
    expect(blue).toBeCloseTo((0 - 0.406) / 0.225, 5);
  });
});

describe("softmax / topk", () => {
  it("normalizes logits to a probability distribution", () => {
    const probs = softmax(new Float32Array([1, 2, 3]));
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("returns the top-k labels in score order", () => {
    const top = topk(new Float32Array([0.1, 0.9, 0.5]), ["a", "b", "c"], 2);
    expect(top.map((t) => t.label)).toEqual(["b", "c"]);
  });
});

describe("real ONNX model", () => {
  it("classifies the cat fixture deterministically", async () => {
    const session = await createOnnxSession(modelConfig, false);
    const { output } = await session.infer(decodeFixture());
    expect(output.label).toBe("cougar, puma, catamount, mountain lion, painter, panther, Felis concolor");
    expect(output.score).toBeGreaterThan(0.5);
    await session.dispose();
  }, 30_000);

  it("rejects tampered model bytes", async () => {
    const tampered = new Uint8Array(modelBytes);
    tampered[100] = (tampered[100] ?? 0) ^ 0xff;
    await expect(
      createOnnxSession(
        {
          ...modelConfig,
          modelBytes: tampered.buffer.slice(tampered.byteOffset, tampered.byteOffset + tampered.byteLength),
        },
        false,
      ),
    ).rejects.toThrow(/integrity check failed/);
  });
});

describe("verifySha256", () => {
  it("accepts matching digests", async () => {
    await expect(
      verifySha256(modelBytes.buffer, "cc028fe6cae7bc11a4ff53cfc9b79c920e8be65ce33a904ec3e2a8f66d77f95f"),
    ).resolves.toBeUndefined();
  });

  it("rejects mismatched digests", async () => {
    await expect(verifySha256(modelBytes.buffer, "0".repeat(64))).rejects.toThrow(/integrity check failed/);
  });
});

describe("MockRuntime", () => {
  it("is deterministic for the same input and salt", async () => {
    const a = new MockRuntime("fixed-salt");
    const b = new MockRuntime("fixed-salt");
    await a.load("m");
    await b.load("m");
    const first = await a.infer({ url: "image://1" });
    const second = await b.infer({ url: "image://1" });
    expect(first.output).toEqual(second.output);
    expect(first.duration).toBe(second.duration);
  });

  it("produces labeled outputs with scores in [0.02, 0.98]", async () => {
    const runtime = new MockRuntime();
    await runtime.load("m");
    for (let i = 0; i < 20; i++) {
      const { output } = await runtime.infer({ url: `image://${i}` });
      const candidate = output as { label: string; score: number };
      expect(["safe", "unsafe"]).toContain(candidate.label);
      expect(candidate.score).toBeGreaterThanOrEqual(0.02);
      expect(candidate.score).toBeLessThanOrEqual(0.98);
    }
  });
});
