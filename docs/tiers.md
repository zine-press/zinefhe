# Evidence tiers

A trace carries exactly one tier. The tier is written into the on-chain record rather than applied
afterwards as a label, and it travels with the output wherever the output goes.

Every tier below is given as a pair: what it guarantees, and what it does not. The two lines ship
together. A guarantee published without its non-guarantee is a claim nobody can check.

---

## attested

**Guarantees.** A signed hardware report, bound to this trace, states that a measured GPU driver
and VBIOS ran inside a confidential virtual machine on genuine silicon.

**Does not guarantee.** That the weights in that machine match the plate, or that the report came
from the machine that served this request. Attestation reports from NVIDIA GPUs are not bound to
the identity of the confidential VM that presents them.

### What it is

The provider runs inference inside a confidential virtual machine with a confidential-computing
GPU. The GPU produces a signed report over its driver and VBIOS measurements, checked against the
vendor's signed reference values. The report is bound to the trace and its hash goes on chain
through `attest_trace`.

### What it covers

That measured firmware and driver ran on genuine silicon, in a machine whose memory was not
readable by the host operating system across the PCIe boundary.

### What it does not cover

Model weights are not measured. On-package HBM is not encrypted; the protection covers what crosses
PCIe. And NVIDIA GPU attestation reports are not bound to the identity of the confidential VM that
presents them, so a report from one machine can in principle be presented by another.

### Cost

On Azure, the confidential H100 size and the non-confidential H100 size of the same generation
carry the same on-demand list price: 6.98 USD per hour, Linux, East US 2, checked against the Azure
retail price API on 2026-08-20. The cost of this tier is therefore not a hardware premium. It is
throughput. Three independent measurements put confidential-computing overhead on H100 at between
minus 0.13 percent and 21 percent, depending on model size, sequence length, and serving mode. Cost
per token rises by roughly the same range.

### Trust assumption

The hardware vendor's root of trust, the vendor's attestation service, and the cloud operator's
platform firmware. Physical attacks are explicitly outside the threat model that both major CPU
vendors publish, and interposer attacks against DDR5 memory have been demonstrated for under
1,000 USD in parts.

---

## sampled

**Guarantees.** This trace was drawn for independent re-execution under a pinned environment, and
an independent node reproduced the output byte for byte.

**Does not guarantee.** Anything about traces that were not drawn. At a 5 percent sampling rate, a
provider who cheats once is caught with probability 0.05, and the chance of being caught at least
once passes 95 percent only after 59 attempts.

### What it is

A fraction of committed traces is drawn at random and re-executed by an independent bonded node
under a pinned environment. The re-run output is hashed and compared byte for byte. A mismatch
opens an incident.

### What it covers

That the drawn trace reproduces exactly. With the execution environment pinned, 10,000 runs on two
hosts produced identical hashes with zero bit-level drift, and a batch-size swing of plus or minus
20 percent did not break that.

### What it does not cover

Traces that were not drawn. Detection follows `1 - (1-p)^K` for sampling rate `p` and `K` dishonest
attempts. At `p = 0.05` the expected number of dishonest traces before the first catch is 20. The
full table is in [sampling.md](sampling.md).

### The condition that makes it work at all

Five properties of the execution must be pinned and recorded: hardware SKU, exact weights and
quantization format, parallelism topology, software and kernel versions, and the batch size of each
forward pass.

One of these cannot be pinned across a heterogeneous provider network. An A100 and an H100 running
the same weights on the same input agree 0.0 percent of the time at the bit level. KORTX therefore
separates verifier pools by GPU architecture. Comparing across architectures would slash honest
providers at a rate near 100 percent.

### Cost

Two components. Re-execution costs the sampling rate times the inference cost: at `p = 0.05`, a 5
percent surcharge on served inference. Determinism costs between 1.8 percent and 133 percent
depending on the serving stack, and the stack must be named whenever that figure is quoted.

### Trust assumption

That at least one independent verifier is running and is not colluding with the provider, and that
both bonds exceed the gain from cheating. A verifier paid only for finding errors earns nothing
while the system works correctly. This is the verifier's dilemma, and it produced a real Bitcoin
fork in July 2015.

---

## proven

**Guarantees.** A zero-knowledge proof certifies that the declared circuit, evaluated on the
committed input, yields the committed output, with no trust in the provider.

**Does not guarantee.** Coverage of transformer language models. The proven tier accepts the model
classes listed below and rejects everything else, rather than degrading quietly.

### What it is

A zero-knowledge proof that the declared circuit, evaluated on the committed input, produces the
committed output. Verification requires no trust in the provider.

### What it covers

The arithmetic of the declared circuit, exactly.

### What it does not cover

The amount of work. A proof certifies that private weights exist which map the input to the output
through the public architecture. It does not certify that the prover spent computation matching the
advertised model size.

### Supported model classes

Linear and logistic regression, support vector machines, decision trees and tree ensembles, and
small convolutional networks. Transformer language models are not accepted at this tier.

### Cost, from the framework author's own published benchmark, 2024-01-28

| Model | Proving time | Memory |
|---|---|---|
| Linear regression | 0.118 s | 19.4 MB |
| Support vector machine classification | 0.318 s | 23.7 MB |
| Tree ensemble regression | 0.308 s | 23.7 MB |
| Random forest classification | 6.161 s | 383 MB |

The same benchmark did not measure proof size and states directly: "Note that for this study, we
omit verification time as a metric." It also states: "More complex models like neural networks are
currently beyond benchmarking scope." A competing zkVM on the same four models took 10.0, 37.5,
10.1, and 173.4 seconds and needed 1.3 GB to 10.2 GB of memory. A third framework failed the random
forest case with out-of-memory errors in an environment holding 1,000 GB of RAM and 64 cores.

### Where the ceiling actually is

A third-party benchmark puts MobileNetV2 at roughly four hours and 204 GB of RAM on the same
framework. Full-inference proofs of language models exist in published research up to 13B
parameters, at 803 seconds on one A100 for a 2,048-token sequence, producing 188 kB. Other
published results reach 7B parameters at 44 minutes for a single token, producing 22.85 MB. A
Solana transaction holds 1,232 bytes, so those artifacts exceed the on-chain limit by 152 times and
18,500 times respectively. On Solana today, only Groth16-class proofs verify on chain directly, at
78,293 to 108,762 compute units.

### Trust assumption

The soundness of the proving system, the correctness of the circuit compiler, and the claim that
the declared architecture is the one the provider advertises. The last of these is not
cryptographic.

---

## Badge microcopy

Short strings for badges, tooltips, and embeds. Each string names its tier.

```text
attested   Hardware-attested execution. Driver and VBIOS measured. Weights not measured.
sampled    Independently re-executed at a stated sampling rate. Unsampled traces not covered.
proven     Zero-knowledge proof of the declared circuit. Supported model classes only.
```

Embed badge label:

```text
Traced by KORTX -- attested
Traced by KORTX -- sampled
Traced by KORTX -- proven
```

The tier is part of the badge. A badge that reads only "Traced by KORTX" is not shipped, because it
lets the weakest tier borrow the credibility of the strongest. This is the single rule that keeps
the tier system from collapsing into one undifferentiated claim, and it is enforced in the SDK
rather than left to whoever renders the badge.
