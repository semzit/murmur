# Murmur — Benchmarks

## Client metrics

- Model loading time
- Inference latency
- GPU memory
- CPU usage
- GPU usage
- Battery impact
- Network bandwidth

## Network metrics

- Tasks/second
- Average completion time
- Worker utilization
- Worker failure rate
- Consensus latency

## Economics: centralized vs. Murmur

Compare:

```
Centralized inference
vs.
Murmur inference
```

| Metric                     | Centralized | Murmur |
| -------------------------- | ----------- | ------ |
| Cost per 1,000 images      | ?           | ?      |
| Server GPU requirements    | ?           | ?      |
| Latency                    | ?           | ?      |
| Reliability                | ?           | ?      |
| Bandwidth                  | ?           | ?      |
| Client compute consumption | —           | ?      |

The critical question:

> Does distributing inference to clients actually reduce the application's infrastructure cost enough to justify the complexity?
