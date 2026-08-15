# Models

## `mobilenetv2-12-int8.onnx` — MobileNet v2 (int8, ImageNet)

- Source: [ONNX model zoo](https://github.com/onnx/models/tree/main/validated/vision/classification/mobilenet) (`mobilenetv2-12-int8.onnx`)
- Size: 3,655,033 bytes
- SHA-256: `cc028fe6cae7bc11a4ff53cfc9b79c920e8be65ce33a904ec3e2a8f66d77f95f`
- Top-1 accuracy (ImageNet): 68.3%
- License: Apache 2.0

Input: `1x3x224x224` float32, RGB, [0,1], normalized with mean `[0.485, 0.456, 0.406]` and std `[0.229, 0.224, 0.225]`.
Output: 1000 logits over ImageNet classes. Labels in `synset.txt` (Apache 2.0, from the same zoo).

## `fixtures/cat.jpg` — e2e/test fixture

- Source: ["Feral cat" by Thad Zajdowicz](https://www.flickr.com/photos/40632439@N00/38960943252), CC0 1.0
- License: CC0 1.0 (no rights reserved)
- Expected classification (deterministic): `cougar, puma, catamount, mountain lion, painter, panther, Felis concolor` (score ~0.64)

## Interchangeability

Murmur's runtime is model-agnostic: a model is just `{ name, modelUrl, sha256, labels, preprocessing }`
(see `OnnxRuntimeOptions` in `@murmur/runtime`). MobileNet here is a demo/CI model — swap it by
changing the runtime configuration and the coordinator's `ModelMetadata`, no protocol changes needed.
