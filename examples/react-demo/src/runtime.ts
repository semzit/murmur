import { createOnnxRuntime } from "@murmur/runtime";
import { MODEL_SHA256 } from "../modelConfig.ts";

export const parseSynset = (content: string): string[] =>
  content
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(line.indexOf(" ") + 1));

export const runtime = createOnnxRuntime({
  models: [
    {
      name: "moderation-v1",
      modelUrl: "/models/mobilenetv2-12-int8.onnx",
      sha256: MODEL_SHA256,
      labels: () =>
        fetch("/models/synset.txt")
          .then((response) => {
            if (!response.ok) throw new Error("failed to fetch labels");
            return response.text();
          })
          .then(parseSynset),
      preprocessing: {
        width: 224,
        height: 224,
        mean: [0.485, 0.456, 0.406],
        std: [0.229, 0.224, 0.225],
      },
      backend: "auto",
    },
  ],
});
