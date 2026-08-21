# Sampling arithmetic

The sampled tier gives a probability, not a guarantee. This page is that probability, written out,
so that the number a trace carries can be read rather than inferred.

## Detection probability

For a sampling rate `p` and `K` dishonest traces, the chance that at least one is drawn and caught
is:

```text
P(caught at least once) = 1 - (1 - p)^K
```

| p | K=1 | K=10 | K=20 | K=50 | K=100 | K=200 |
|---|---|---|---|---|---|---|
| 1% | 1.00% | 9.56% | 18.21% | 39.50% | 63.40% | 86.60% |
| 2% | 2.00% | 18.29% | 33.24% | 63.58% | 86.74% | 98.24% |
| 5% | 5.00% | 40.13% | 64.15% | 92.31% | 99.41% | 99.99% |
| 10% | 10.00% | 65.13% | 87.84% | 99.48% | 99.99% | 99.99% |
| 20% | 20.00% | 89.26% | 98.85% | 99.99% | 99.99% | 99.99% |

**Read the first column, not the last.** A provider who cheats once at a 5 percent sampling rate is
caught 5 percent of the time. Sampling is a deterrent priced against a bond, not a guarantee.

99.99 percent means at least 99.99 percent. It is never 100. For any finite `K`, `1 - (1-p)^K` stays
below 1, so cells that would round up to 100.00 are written as 99.99 instead.

## What the table does not say

At `p = 0.05` the expected number of dishonest traces before the first catch is 20. A provider who
cheats once and stops is very likely never caught. The design consequence is that the sampled tier
cannot be priced as though it detected everything: the bond has to exceed the expected gain from a
run of undetected attempts, not the gain from one.

The table also assumes independent draws. A provider who can predict which traces will be sampled
faces a different, and much better, set of odds. Sample selection therefore has to be unpredictable
to the provider at commit time, which is why the draw is derived after the trace is committed rather
than chosen by the party that commits it.

## Why byte equality is not the comparison

A naive reading of "re-execute and compare" assumes the comparison is byte equality on the output.
Across a heterogeneous verifier set, that comparison slashes honest providers.

- At temperature 0, the same prompt run 1,000 times produced 80 distinct outputs. The first 102
  tokens were identical every time; divergence began at token 103.
- With the execution environment pinned, 10,000 runs produced identical hashes and zero bit-level
  drift.
- An A100 and an H100 running the same weights on the same input agree 0.0 percent of the time at
  the bit level.
- Across a batch-size sweep, 0.3 to 1.3 percent of decode steps flip a token. More than 98.7
  percent are stable, but decoding is autoregressive, so one flipped token diverges the rest of the
  sequence.

The protocol therefore carries a `divergence_bps` tolerance on each `RerunRecord` and resolves an
incident by quorum over `mismatch_votes` and `match_votes`, rather than by a single byte
comparison. Verifier pools are separated by GPU architecture for the same reason.

## Why the re-run is commit-reveal

A verifier can read the committed output hash off the chain. If the protocol accepted a bare
re-run result, the cheapest strategy would be to echo that hash back and collect the reward for
having reproduced nothing.

`submit_rerun` therefore takes a commitment first:

```text
commitment = hash(output_hash, salt, verifier, subject)
```

and the reveal is checked against it. A reveal that does not reconstruct the stored commitment is
rejected. The salt keeps two verifiers from recognising each other's commitments before the reveal
window closes.

## Cost

Re-execution costs the sampling rate times the inference cost: at `p = 0.05`, a 5 percent surcharge
on served inference. Determinism costs a further 1.8 percent to 133 percent depending on the serving
stack, and the stack must be named whenever that figure is quoted.

## The economic assumption underneath

A verifier who is paid only for finding errors has no income while the system works correctly. This
is the verifier's dilemma, and it caused a real Bitcoin fork in July 2015. The sampled tier assumes
at least one independent verifier is running and is not colluding with the provider, and that both
bonds exceed the gain from cheating. That assumption is not removable by a parameter change.
