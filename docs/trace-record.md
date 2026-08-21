# The trace record

A trace is the unit KORTX records. This page describes what a trace fixes, what surrounds it on
chain, and which parts are load-bearing.

The authoritative layout is the IDL, not this page:
[`idl/kortx.json`](https://github.com/kortx-labs/kortx-solana/blob/main/idl/kortx.json) in
`kortx-solana`, byte-identical to the copy published on chain at program
`Eag1WgBbZay94E6Z9dLfUcgGUiDZRLD8Qc9qNNK6a7NS` on `devnet`. When this page and the IDL disagree,
the IDL is right and this page is a bug.

---

## What a trace fixes

Four things that cannot be revised after the fact.

**The commitment.** An input hash, an output hash, a model fingerprint, and a seed, written to
Solana by an account that has posted a bond, at a known slot. The record is public and it is not
editable by the party that wrote it.

**The class of evidence.** Every trace carries one of three tiers -- `attested`, `sampled`, or
`proven` -- and each tier states its own coverage on the record itself. A trace never inherits the
strength of a tier it did not use. See [tiers.md](tiers.md).

**The challenge history.** Whether an independent party opened an incident against the record, what
their re-execution produced, and how the dispute resolved. Bonds move on that outcome.

**The provider's record over time.** Traces committed, incidents opened, mismatches found, bond
remaining. A provider's history is the part of KORTX that is hardest to fake, because it is
cumulative and adversarial.

---

## Accounts

Six account types. Seeds are the PDA derivation; everything else is the IDL's business.

| Account | Seeds | Role |
|---|---|---|
| `Config` | `["config"]` | Protocol parameters and cumulative counters |
| `Plate` | `["plate", provider, model_id_hash]` | A registered model and its posted bond |
| `Trace` | `["trace", plate, nonce]` | One inference |
| `Incident` | `["incident", trace, index]` | One challenge against a trace |
| `RerunRecord` | `["rerun", subject, verifier]` | One verifier's commit-reveal re-execution |
| `Verifier` | `["verifier", authority]` | A node, its bond, and its record |

### Trace

The fields that carry meaning rather than bookkeeping:

```text
plate               the model this inference claims to come from
provider            the bonded account that committed it
nonce               monotonic per plate; makes the address deterministic
input_hash          [u8; 32]
output_hash         [u8; 32]
model_fingerprint   [u8; 32], must equal the plate's fingerprint at commit time
seed                [u8; 32]
tier                Attested | Sampled | Proven
evidence_uri        where the off-chain evidence lives
committed_at        unix seconds, from the chain clock
committed_slot      the slot; a stronger ordering statement than the timestamp
challenge_deadline  after this, the trace can no longer be challenged
status              Committed | Verified | Challenged | Mismatched | Slashed
attestation         Option, present at the attested tier
proof               Option, present at the proven tier
confirmations       how many verifiers reproduced it
divergences         how many did not
```

`attestation` and `proof` are options rather than a flattened blob because a trace at one tier must
not be able to present a field belonging to another. The tier and the evidence are checked against
each other in the instruction that writes them.

### Plate

A plate is the model registration and the bond behind it. It carries `weights_hash`,
`model_fingerprint`, `version`, and a `DeterminismPolicy`:

```text
temperature_milli   sampling temperature in thousandths; 0 means greedy decoding
top_p_milli         nucleus cutoff in thousandths; 1000 means no truncation
seed_bound          largest seed the provider commits to using
```

The policy is on chain because a re-run comparison is meaningless without it. Two runs of the same
weights on the same input with different decoding parameters are not expected to agree, and a
protocol that slashed on that difference would be punishing a configuration change rather than
dishonesty.

`Plate` also carries the cumulative statistics that make a provider's history readable:
`trace_count`, `incident_count`, `mismatch_count`, `open_incidents`, `slashed_total`.

### Incident and RerunRecord

An incident has two deadlines, not one:

```text
commit_deadline     verifiers must post their commitment by here
reveal_deadline     verifiers must reveal by here
```

and it resolves on a quorum:

```text
required_quorum     from Config, raised by the plate if the plate asks for more
reruns_committed    how many verifiers committed
reruns_revealed     how many revealed
mismatch_votes      how many reproduced something different
match_votes         how many reproduced the committed output
verdict             the resolution
```

Each participating verifier writes a `RerunRecord`:

```text
kind                IncidentRerun | Sample | ProofCheck | AttestationCheck
commitment          [u8; 32]
output_hash         [u8; 32], written at reveal
divergence_bps      how far this re-run diverged, in basis points
matched             the judgement for this one verifier
```

---

## The two mechanisms that carry the design

Everything else is bookkeeping around these two.

### Commit-reveal on re-runs

A verifier writes

```text
commitment = hash(output_hash, salt, verifier, subject)
```

before revealing `output_hash` and `salt`. Without this step the cheapest verifier strategy is to
read the committed output hash off the chain and echo it back, collecting a reward for having
reproduced nothing. The reveal is checked against the stored commitment and a reveal that does not
reconstruct it is rejected.

The `verifier` and `subject` fields are inside the pre-image so that one verifier's commitment
cannot be replayed by another, or against a different trace.

### A divergence tolerance in basis points

Two GPUs running the same weights on the same input do not agree bit for bit. An A100 and an H100
agree 0.0 percent of the time at the bit level. Across a batch-size sweep, 0.3 to 1.3 percent of
decode steps flip a token, and because decoding is autoregressive one flip diverges the rest of the
sequence.

A protocol that demanded byte equality across a heterogeneous verifier set would slash honest
providers at a rate near 100 percent. `RerunRecord` therefore carries `divergence_bps`, the verdict
is a quorum decision rather than a single comparison, and verifier pools are separated by GPU
architecture.

Drop either mechanism and the protocol stops meaning anything. Without commit-reveal, verification
is free to fake. Without the tolerance, honest providers are slashed for physics.

---

## Lifecycle

```text
register_plate    provider posts a bond and registers a model
commit_trace      provider writes the hashes and the tier
                  attest_trace | submit_sample_result | submit_proof
open_incident     any bonded challenger disputes the record
submit_rerun      verifiers commit, then reveal
resolve_incident  quorum decides; bonds move; the trace's status is final
```

Bond movement on resolution is split by basis points from `Config`: `slash_bps` from the losing
side, of which `burn_bps` is burned, `challenger_bps` goes to the challenger, and `verifier_bps` is
divided among the verifiers who revealed. A false challenge costs the challenger their bond, which
is what keeps `open_incident` from being free.

---

## Cost

Committing one trace on Solana costs 0.0032762 SOL: 3,271,200 lamports of rent exemption for a
342-byte account plus a 5,000-lamport signature fee.

---

## Canonicalization

Hashes are only comparable if everyone produces them the same way. The canonical form is `KCF-1`,
specified in
[CANONICALIZATION.md](https://github.com/kortx-labs/kortx-sdk/blob/main/packages/sdk-ts/CANONICALIZATION.md)
and implemented once, in the SDK. The SDK, the CLI, the indexer, and the verifier node all read that
one definition, because a trace id computed one way and checked another is a false mismatch that
costs somebody their bond over a formatting difference.
