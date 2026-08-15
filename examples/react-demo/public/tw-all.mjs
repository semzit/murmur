import "/@fs/home/omes/coding/murmur/node_modules/.pnpm/vite@7.3.6_@types+node@20.19.43_tsx@4.23.12/node_modules/vite/dist/client/env.mjs";
import * as ort from "/@fs/home/omes/coding/murmur/node_modules/.pnpm/onnxruntime-web@1.27.0/node_modules/onnxruntime-web/dist/ort.min.mjs?v=3718dfb6";
import mainWasmUrl from "/@fs/home/omes/coding/murmur/node_modules/.pnpm/onnxruntime-web@1.27.0/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?import";
import { createOnnxSession } from "/@fs/home/omes/coding/murmur/packages/runtime/src/onnxSession.ts";
ort.env.wasm.wasmPaths = { "ort-wasm-simd-threaded.wasm": mainWasmUrl };
self.postMessage("all-ok " + typeof createOnnxSession + " " + typeof ort.env.wasm);
