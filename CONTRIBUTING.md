# Contributing

Thanks for looking. This repository is the written record of the protocol, and it has one rule
that matters more than the rest.

## Every number carries its condition

A figure in these documents is a measurement someone published, with the hardware, the sequence
length, the serving stack or the sampling rate that produced it. A number with its condition
stripped off is a different number. If you cannot cite where a figure came from, the correct edit
is to remove it, not to round it.

The same applies in the other direction: do not soften a limitation to make a section read better.
The limitations are the reason this repository exists.

## Before you open a pull request

```bash
node tools/check-docs.mjs
```

CI runs exactly this. It checks that the program id and cluster are consistent everywhere they
appear, that no document quotes a verification claim without naming its tier, that the phrases
this project has ruled out do not reappear, and that no emoji have crept in.

## Adding a document

Register it in `tools/check-docs.mjs` under `REQUIRED_DOCS` if it belongs to the core set, so the
checker fails when it goes missing rather than quietly skipping it. A checker that scans a shorter
list than it did yesterday reports the same clean result either way.

## Commit messages

Plain sentences describing what changed. No prefix conventions, no emoji.

## License

By contributing you agree that your contribution is licensed under the MIT License in
[LICENSE](LICENSE).
