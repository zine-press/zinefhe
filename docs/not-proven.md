# What KORTX does NOT prove

This document is not a disclaimer appended to a sales page. It is the reason the rest of the
protocol is shaped the way it is, and it is the first document to read.

A verification system that cannot say where its own coverage stops is not a verification system.
Every claim below is a limit that holds today, with the measurement that establishes it. Where a
figure appears, the condition that produced it appears with it, because a number with its
condition stripped off is a different number.

---

## The seven limits

**KORTX does not prove that a model is good.** It checks whether a computation can be reproduced
or certified. A reproducible model can still be wrong, biased, or unsafe. Reproducibility is a
property of the execution, not of the answer.

**KORTX does not prove that the declared weights are the weights that ran, except where the tier
says so.** Hardware attestation measures the driver and the VBIOS. It does not measure model
weights.

**KORTX does not prove that a prover spent computation matching the advertised model size.** A
zero-knowledge proof certifies that an equation holds. It does not certify an amount of work.
Published research demonstrates a model that presents itself as twelve layers while computing six,
at no additional serving cost.

**KORTX does not prove anything about an inference that was not sampled.** The sampled tier gives a
probability, and the sampling rate that produced it is printed on the record. The arithmetic is in
[sampling.md](sampling.md).

**KORTX does not carry a zero-knowledge proof of a full large language model forward pass.** No
system does today. The published ceiling for full-inference proofs is 13B parameters, at 803
seconds on one A100 for a single 2,048-token sequence, producing a 188 kB artifact. A Solana
transaction holds 1,232 bytes.

**KORTX does not survive a compromise of the hardware vendor's root of trust at the attested
tier.** Trust at that tier reduces to the silicon vendor and the vendor's attestation service.

**KORTX does not detect a provider who is honest on sampled traces and dishonest elsewhere, beyond
the probability the sampling rate gives.** That probability is stated, not implied.

---

## Why determinism is the hard part

The intuition that an inference either reproduces or does not is wrong, and every design decision
in the sampled tier follows from how wrong it is.

At temperature 0, the same prompt run 1,000 times produced 80 distinct outputs. The first 102
tokens were identical every time; divergence began at token 103. Temperature 0 selects the
highest-probability token, but it does not make the arithmetic that produces those probabilities
identical across runs.

With the execution environment pinned, 10,000 runs produced identical hashes and zero bit-level
drift. So determinism is achievable. It is achievable only when five properties are pinned and
recorded:

1. hardware SKU
2. exact weights and quantization format
3. parallelism topology
4. software and kernel versions
5. the batch size of each forward pass

Across a batch-size sweep, 0.3 to 1.3 percent of decode steps flip a token. More than 98.7 percent
are stable, which sounds reassuring until you remember that decoding is autoregressive: one flipped
token is enough to diverge the rest of the sequence.

One of the five cannot be pinned across a heterogeneous provider network. An A100 and an H100
running the same weights on the same input agree 0.0 percent of the time at the bit level. KORTX
therefore separates verifier pools by GPU architecture. Comparing across architectures would slash
honest providers at a rate near 100 percent.

Making inference deterministic is not free. It costs between 1.8 percent and 133 percent depending
on the serving stack, and the stack must be named whenever that figure is quoted.

---

## Why the attested tier stops where it does

Confidential computing protects what crosses the PCIe boundary. It does not measure what the model
is.

- Attestation measures the GPU driver and the VBIOS. It does not measure model weights.
- Attestation reports from NVIDIA GPUs are not bound to the identity of the confidential virtual
  machine that presents them. A report produced on one machine can in principle be presented by
  another.
- On-package HBM is not encrypted. The protection covers the PCIe boundary, not the package.
- Physical attacks are explicitly outside the threat model that both major CPU vendors publish, and
  physical interposer attacks against DDR5 memory have been built for under 1,000 USD in parts.

The cost of this tier is not a hardware premium. Azure charges the same on-demand list price for
the confidential H100 size and the non-confidential H100 size of the same generation: 6.98 USD per
hour, Linux, East US 2, checked against the Azure retail price API on 2026-08-20. The cost is
throughput. Three independent measurements put confidential-computing overhead on H100 at between
minus 0.13 percent and 21 percent, depending on model size, sequence length, and serving mode.
Cost per token rises by roughly the same range.

---

## Why the proven tier is narrow

The proven tier accepts a short list of model classes and rejects everything else, rather than
degrading quietly. The list is in [tiers.md](tiers.md). Here is why it is short.

From the framework author's own published benchmark, 2024-01-28:

| Model | Proving time | Memory |
|---|---|---|
| Linear regression | 0.118 s | 19.4 MB |
| Support vector machine classification | 0.318 s | 23.7 MB |
| Tree ensemble regression | 0.308 s | 23.7 MB |
| Random forest classification | 6.161 s | 383 MB |

The same benchmark did not measure proof size, and states directly: "Note that for this study, we
omit verification time as a metric." It also states: "More complex models like neural networks are
currently beyond benchmarking scope."

A competing zkVM on the same four models took 10.0, 37.5, 10.1, and 173.4 seconds and needed
1.3 GB to 10.2 GB of memory. A third framework failed the random forest case with out-of-memory
errors in an environment holding 1,000 GB of RAM and 64 cores.

Beyond that list the numbers stop being about cost and start being about feasibility. A third-party
benchmark puts MobileNetV2 at roughly four hours and 204 GB of RAM. Full-inference proofs of
language models exist in published research up to 13B parameters, at 803 seconds on one A100 for a
2,048-token sequence, producing 188 kB. Other published results reach 7B parameters at 2,645
seconds for a single token, producing a 22.85 MB proof on a server with 4 TB of RAM.

Proof artifacts therefore run from 188 kB to 22.85 MB. A Solana transaction holds 1,232 bytes.
Those artifacts exceed the on-chain limit by 152 times and 18,500 times respectively. On Solana
today, only Groth16-class proofs verify on chain directly, at 78,293 to 108,762 compute units
against a 1,400,000 unit transaction ceiling.

Two more properties of this class of system are worth stating plainly. Non-linear functions are
approximated by lookup tables, and residual error at the 99th percentile is 0.158 percent for GELU
and SiLU. Every proving system in this class quantizes to integers; one reports cosine similarity
of at least 99.6 percent against the unquantized model. Neither of those is a defect, but both mean
that "the proof verifies" and "the floating-point model produced this" are not the same statement.

Proving a production workload cost 75 times the inference it certified.

---

## The economic limit nobody can patch

A verifier who is paid only for finding errors has no income while the system works correctly. This
is the verifier's dilemma, and it caused a real Bitcoin fork in July 2015.

KORTX pays verifiers from bond flow and from a share of the protocol fee rather than from
detections alone, but the dilemma is structural, not a bug to be closed. The honest statement is
that the sampled tier depends on at least one independent verifier running and not colluding with
the provider, and on both bonds exceeding the gain from cheating.

---

## What it costs to write a trace

Committing one trace on Solana costs 0.0032762 SOL: 3,271,200 lamports of rent exemption for a
342-byte account plus a 5,000-lamport signature fee.

---

## Phrasing rules that follow from all of this

These are enforced by [`tools/check-docs.mjs`](../tools/check-docs.mjs), not left to good
intentions.

1. A verification claim without its tier is not published. The tier is what makes the claim true or
   false, so removing it makes the sentence unfalsifiable rather than shorter.
2. Any absolute claim about verification strength is rejected. No tier in this system removes all
   trust assumptions, and copy that implies otherwise is a factual error.
3. Every number carries its condition: the hardware, the sequence length, the serving stack, the
   sampling rate.
4. Nothing here describes buying, selling, renting, or brokering computation. That is a different
   kind of system. The same applies to language about registering the identity of an agent or a
   model, rather than checking the output of one.
5. No superlative about being earliest or only.
