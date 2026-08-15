# Murmur — Security

## Core assumption

**A browser cannot automatically be trusted.** A malicious client could simply claim:

```
"I ran the model. Result = safe."
```

…without doing any computation.

## Initial defenses

### Redundancy

Require multiple independent clients to evaluate the same task.

### Reputation

Track client reliability:

```
Client A
accuracy: 99.2%
tasks: 10,482
reputation: high
```

### Calibration tasks

Occasionally send known evaluation inputs. The client never knows which tasks are calibration tasks.

### Randomized task assignment

Avoid predictable workloads that can be gamed.

## Sybil resistance

One attacker can create many clients and dominate consensus:

```
Attacker
  |
  +-- Client 1
  +-- Client 2
  +-- Client 3
  +-- Client 4
  +-- ...
```

Possible defenses:

- Rate limiting
- Reputation
- Proof-of-work for task participation
- Device/browser signals
- Account reputation
- Random sampling
- Independent task assignment
- Cost-based participation
- Server-side verification of suspicious results

**MVP stance:** document the limitation; rely on redundant workers.

## Threat model

Document and test against:

- Malicious clients
- Fake results
- Replay attacks
- Task tampering
- Model tampering
- Model substitution
- Sybil attacks
- Coordinator compromise
- Malicious task submission
- Resource exhaustion
- Client fingerprinting
- Privacy leakage

Every protocol message should eventually have clear authentication and integrity guarantees.

## Privacy

Local inference means the model processes content **without sending the raw input** to a centralized server:

```
                 IMAGE
                   |
                   v
              USER BROWSER
                   |
             local inference
                   |
                   v
              CLASSIFICATION
                   |
                   v
             "unsafe: 0.91"
                   |
                   v
                SERVER
```

Caveats:

- Task distribution itself can reveal information.
- The browser can inspect everything it receives.
- Privacy is a **design constraint, not an automatic guarantee**.

## Future research

- Verifiable computation
- Trusted execution environments
- Zero-knowledge proofs
- Remote attestation
- Cryptographic commitments

None of these block the MVP.
