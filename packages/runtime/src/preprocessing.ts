export interface ModelPreprocessingConfig {
  width: number;
  height: number;
  mean: [number, number, number];
  std: [number, number, number];
}

export interface OnnxModelConfig {
  /** Matches the task's `model` name. */
  name: string;
  modelUrl: string;
  /** Hex SHA-256 digest of the model file; verified before execution when provided. */
  sha256?: string;
  labels: string[] | (() => Promise<string[]>);
  preprocessing: ModelPreprocessingConfig;
  /** Preferred backend; falls back to the next available. */
  backend?: "webgpu" | "wasm" | "auto";
}

export interface OnnxRuntimeOptions {
  models: OnnxModelConfig[];
  /** Cache downloaded model bytes in the Cache API (browser only). */
  cache?: boolean;
}

/**
 * Bilinear resize of an RGBA8 image. Pure function shared by the browser
 * worker and Node tests so preprocessing is identical everywhere.
 */
export function resizeBilinear(
  rgba: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dstWidth * dstHeight * 4);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;
  for (let y = 0; y < dstHeight; y++) {
    const srcY = y * yRatio;
    const y0 = Math.min(Math.floor(srcY), srcHeight - 1);
    const y1 = Math.min(y0 + 1, srcHeight - 1);
    const fy = srcY - y0;
    for (let x = 0; x < dstWidth; x++) {
      const srcX = x * xRatio;
      const x0 = Math.min(Math.floor(srcX), srcWidth - 1);
      const x1 = Math.min(x0 + 1, srcWidth - 1);
      const fx = srcX - x0;
      const o = (y * dstWidth + x) * 4;
      const p00 = y0 * srcWidth * 4 + x0 * 4;
      const p01 = y0 * srcWidth * 4 + x1 * 4;
      const p10 = y1 * srcWidth * 4 + x0 * 4;
      const p11 = y1 * srcWidth * 4 + x1 * 4;
      for (let c = 0; c < 4; c++) {
        const top = (rgba[p00 + c] ?? 0) * (1 - fx) + (rgba[p01 + c] ?? 0) * fx;
        const bottom = (rgba[p10 + c] ?? 0) * (1 - fx) + (rgba[p11 + c] ?? 0) * fx;
        out[o + c] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  return out;
}

/**
 * Converts an RGBA8 image into a normalized NCHW float32 tensor matching
 * the model's expected input (e.g. 1x3x224x224 with ImageNet mean/std).
 */
export function preprocessToTensor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  config: ModelPreprocessingConfig,
): Float32Array {
  const resized = resizeBilinear(rgba, width, height, config.width, config.height);
  const tensor = new Float32Array(1 * 3 * config.width * config.height);
  const total = config.width * config.height;
  for (let i = 0; i < total; i++) {
    const r = (resized[i * 4] ?? 0) / 255;
    const g = (resized[i * 4 + 1] ?? 0) / 255;
    const b = (resized[i * 4 + 2] ?? 0) / 255;
    tensor[i] = (r - config.mean[0]) / config.std[0];
    tensor[total + i] = (g - config.mean[1]) / config.std[1];
    tensor[2 * total + i] = (b - config.mean[2]) / config.std[2];
  }
  return tensor;
}

export function softmax(logits: Float32Array): Float32Array {
  const out = new Float32Array(logits.length);
  let max = -Infinity;
  for (const value of logits) max = Math.max(max, value);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    out[i] = Math.exp((logits[i] ?? 0) - max);
    sum += out[i] ?? 0;
  }
  for (let i = 0; i < out.length; i++) {
    out[i] = (out[i] ?? 0) / sum;
  }
  return out;
}

export function topk(probabilities: Float32Array, labels: string[], k = 1): Array<{ label: string; score: number }> {
  const indices = Array.from({ length: probabilities.length }, (_, i) => i);
  indices.sort((a, b) => (probabilities[b] ?? 0) - (probabilities[a] ?? 0));
  return indices.slice(0, k).map((index) => ({
    label: labels[index] ?? `class_${index}`,
    score: probabilities[index] ?? 0,
  }));
}
