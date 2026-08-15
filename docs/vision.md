# Murmur — Vision

## What is Murmur?

A **browser-native distributed inference network**.

> Applications can delegate machine-learning inference to the clients that are already using them.

Instead of sending every input to a centralized GPU server, a participating browser runs an ML model locally (WebGPU/WASM) and returns an inference result. Multiple independent clients evaluate the same task, allowing the network to aggregate results and improve reliability.

## Core concept

```
                    Application
                         |
                    Murmur Client
                         |
             +-----------+-----------+
             |           |           |
           WebGPU       WASM        CPU
             |           |           |
             +-----------+-----------+
                         |
                    Local Model
                         |
                    Inference
                         |
                    Result
                         |
                    Coordinator
```

Tasks requiring stronger confidence are assigned to multiple clients:

```
                         IMAGE
                           |
              +------------+------------+
              |            |            |
           Client A     Client B     Client C
              |            |            |
           Model A      Model A      Model A
              |            |            |
            0.02         0.04         0.01
              |            |            |
              +------------+------------+
                           |
                      Aggregation
                           |
                     Final Result
```

The network separates four concerns:

1. **Task distribution**
2. **Local inference**
3. **Result verification**
4. **Consensus / aggregation**

## MVP goal

Build a React application where:

1. A server has an image.
2. The server creates a moderation task.
3. Multiple connected browsers receive the same image.
4. Each browser runs the same moderation model locally.
5. Each browser returns a result.
6. The server aggregates the results.
7. The final moderation result is displayed.

**First objective:** prove that browsers can collectively perform useful ML inference for an application.

### Explicitly out of scope for MVP

- Cryptocurrency
- Payments
- Zero-knowledge proofs
- Sophisticated peer-to-peer networking
- A fully decentralized coordinator
- A huge model marketplace

## Long-term vision

Murmur becomes an npm/JavaScript infrastructure layer for distributed AI inference on the web.

Potential applications:

- Content moderation
- Image classification
- OCR
- Spam detection
- Toxicity classification
- Embeddings
- Computer vision
- Lightweight AI inference
- Other embarrassingly-parallel ML workloads

## Roadmap

| Phase                     | Goal                                                                       | Success criterion                                       |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| 0 — Research              | Evaluate WebGPU, ONNX Runtime Web, Transformers.js, workers, model caching | Technology decisions made                               |
| 1 — Local inference       | Single-browser prototype (React, image, WebGPU, WASM fallback)             | A normal browser runs useful inference without freezing |
| 2 — Distributed prototype | WebSocket coordinator, registration, tasks, aggregation, dashboard         | Multiple browsers produce a combined result             |
| 3 — SDK                   | `@murmur/*` packages, types, docs, npm publishing                          | Another developer integrates Murmur in minutes          |
| 4 — Moderation            | Moderation model, consensus, calibration, reputation, demo                 | Distributed moderation is useful and cost-effective     |
| 5 — Optimization          | Quantization, caching, batching, adaptive assignment                       | Lower latency, better resource use                      |
| 6 — Decentralization      | WebRTC, peer discovery, distributed reputation, verifiable inference       | Only after the centralized coordinator works well       |

## Definition of success

```
                 ONE IMAGE
                     |
        +------------+------------+
        |            |            |
     Browser 1    Browser 2    Browser 3
        |            |            |
       GPU          GPU          GPU
        |            |            |
      model        model        model
        |            |            |
        +------------+------------+
                     |
                 CONSENSUS
                     |
                  RESULT
```

…and then:

```bash
npm install @murmur/react
```

…reproduces the same behavior inside a developer's own application. That is the core proof of concept.
