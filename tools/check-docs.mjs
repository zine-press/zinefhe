#!/usr/bin/env node
/**
 * Consistency checks for the protocol record.
 *
 * These documents make claims about a live program and quote measurements from
 * published sources. Both rot in the same silent way: an id changes and the
 * explorer link still looks like a working link, or a sentence gets tightened
 * in editing and loses the tier that made it falsifiable. Neither is visible to
 * a reader, so neither is left to review.
 *
 *   1. one program id, one cluster, everywhere
 *   2. every explorer link carries cluster=
 *   3. no truncated addresses
 *   4. no verification claim without a tier next to it
 *   5. no phrase this project has ruled out
 *   6. no emoji, no check symbols
 *   7. the required documents exist and are not stubs
 *
 * Exit codes: 0 pass, 1 violations found, 2 could not run the check at all.
 *
 * `--selftest` runs the checker against fixtures that are supposed to fail, and
 * against one that is supposed to pass. A checker with no control group cannot
 * be told apart from a checker that always passes.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const PROGRAM_ID = "Eag1WgBbZay94E6Z9dLfUcgGUiDZRLD8Qc9qNNK6a7NS";
const CLUSTER = "devnet";
const MIN_LINES = 40;

const REQUIRED_DOCS = [
  "README.md",
  "docs/not-proven.md",
  "docs/architecture.md",
  "docs/trace-record.md",
  "docs/tiers.md",
  "docs/sampling.md",
];

const BASE58 = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const ABBREVIATED = /[1-9A-HJ-NP-Za-km-z]{3,10}(?:\.\.\.|…)[1-9A-HJ-NP-Za-km-z]{3,10}/g;
const EXPLORER = /https:\/\/explorer\.solana\.com\/[^\s)"'`]+/g;
const CLUSTER_WORD = /\b(mainnet-beta|devnet|testnet)\b/g;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2705}\u{274C}\u{2714}\u{2716}\u{2B50}]|:[a-z_]{2,}:/gu;

// Phrases ruled out, and why. A claim of verification strength without the tier
// that produced it is unfalsifiable rather than short; the market vocabulary
// belongs to a different kind of system.
const RULED_OUT = [
  [/\bfully verified AI\b/i, "verification strength without a tier"],
  [/\btrustless AI\b/i, "no tier removes every trust assumption"],
  [/\bprovably correct AI\b/i, "correctness is not what any tier certifies"],
  [/\bGPU (?:rental|marketplace)\b/i, "brokering computation is a different system"],
  [/\bcompute (?:rental|marketplace)\b/i, "brokering computation is a different system"],
  [/\bOpenAI-compatible\b/i, "this is not a serving API"],
  [/\bidentity registry\b/i, "checking an output is not registering an identity"],
  [/\battestation registry\b/i, "checking an output is not registering an identity"],
  [/\b(?:the )?(?:first|only) (?:project|protocol|system|layer) to\b/i, "no earliest-or-only claims"],
];

// A sentence that claims something *was* verified has to sit in a section that
// names the tier which did it. Scope is the section rather than the sentence,
// because the tier is usually the heading the sentence lives under.
//
// Negated sentences are exempt on purpose. "KORTX does not prove that a model
// is good" is the kind of sentence this project exists to publish, and a rule
// that penalised it would push the documents toward saying less. A gate that
// punishes an honest statement manufactures dishonesty.
const VERIFY_CLAIM = /\b(?:is|are|was|were|has been|have been)\s+(?:independently\s+|cryptographically\s+)?(?:verified|proven|certified|guaranteed)\b|\b(?:proves|guarantees|certifies)\b/i;
const NEGATED = /\b(?:not|never|cannot|can't|no|nothing|neither|without|beyond|stops|fails)\b/i;
const TIER_NAME = /\b(attested|sampled|proven|tier)\b/i;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

/**
 * Split a document into sections at markdown headings, carrying the ancestor
 * headings with each one. `### What it does not cover` under `## proven` is
 * about the proven tier; dropping the parent heading would make that section
 * look like an untiered claim, which is the false positive this avoids.
 *
 * Fenced blocks are code, so their contents are excluded from prose checks.
 */
function sections(text) {
  const lines = text.split("\n");
  const out = [];
  const stack = [];
  let cur = { line: 1, context: "", body: [] };
  let fenced = false;
  lines.forEach((raw, i) => {
    if (/^\s*```/.test(raw)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(cur);
      const depth = h[1].length;
      stack.length = Math.max(0, Math.min(stack.length, depth - 1));
      stack[depth - 1] = h[2];
      cur = { line: i + 1, context: stack.filter(Boolean).join(" / "), body: [] };
      return;
    }
    cur.body.push([i + 1, raw]);
  });
  out.push(cur);
  return out.filter((s) => s.body.some(([, l]) => l.trim() !== ""));
}

/** Sentence split that is good enough for prose; abbreviations are not a risk here. */
function sentences(line) {
  return line.split(/(?<=[.;:])\s+/).filter((s) => s.trim() !== "");
}

function check(root) {
  const files = walk(root).sort();
  const result = { scanned: 0, skipped: 0, violations: [], selfFail: null };

  if (files.length === 0) {
    result.selfFail = "no markdown files found -- an empty tree scores full marks";
    return result;
  }

  for (const doc of REQUIRED_DOCS) {
    let lines;
    try {
      lines = readFileSync(join(root, doc), "utf8").split("\n").length;
    } catch {
      result.violations.push([doc, 0, "required document is missing"]);
      continue;
    }
    if (lines < MIN_LINES) {
      result.violations.push([doc, 0, `required document is ${lines} lines, under ${MIN_LINES}`]);
    }
  }

  for (const path of files) {
    const rel = relative(root, path);
    const text = readFileSync(path, "utf8");
    result.scanned += 1;

    for (const id of new Set(text.match(BASE58) ?? [])) {
      if (id !== PROGRAM_ID) {
        result.violations.push([rel, lineOf(text, id), `base58 value that is not the program id: ${id}`]);
      }
    }

    for (const abbr of new Set(text.match(ABBREVIATED) ?? [])) {
      result.violations.push([rel, lineOf(text, abbr), `truncated address: ${abbr}`]);
    }

    for (const url of new Set(text.match(EXPLORER) ?? [])) {
      if (!url.includes("cluster=")) {
        result.violations.push([rel, lineOf(text, url), `explorer link without cluster=: ${url}`]);
      } else if (!url.includes(`cluster=${CLUSTER}`)) {
        result.violations.push([rel, lineOf(text, url), `explorer link on the wrong cluster: ${url}`]);
      }
    }

    for (const word of new Set(text.match(CLUSTER_WORD) ?? [])) {
      if (word !== CLUSTER) {
        result.violations.push([rel, lineOf(text, word), `cluster named other than ${CLUSTER}: ${word}`]);
      }
    }

    for (const hit of new Set(text.match(EMOJI) ?? [])) {
      result.violations.push([rel, lineOf(text, hit), `emoji or check symbol: ${JSON.stringify(hit)}`]);
    }

    for (const [re, why] of RULED_OUT) {
      const m = text.match(re);
      if (m) result.violations.push([rel, lineOf(text, m[0]), `ruled out (${why}): ${m[0]}`]);
    }

    for (const sec of sections(text)) {
      const scope = [sec.context, ...sec.body.map(([, l]) => l)].join(" ");
      if (TIER_NAME.test(scope)) continue;
      for (const [line, raw] of sec.body) {
        for (const s of sentences(raw)) {
          if (VERIFY_CLAIM.test(s) && !NEGATED.test(s)) {
            result.violations.push([
              rel,
              line,
              `verification claim with no tier named in its section: ${s.trim().slice(0, 70)}`,
            ]);
          }
        }
      }
    }
  }

  return result;
}

function lineOf(text, needle) {
  const idx = text.indexOf(needle);
  return idx < 0 ? 0 : text.slice(0, idx).split("\n").length;
}

function report(root) {
  const r = check(root);
  if (r.selfFail) {
    console.error(`scanned=0`);
    console.error(`verdict=SELF-FAIL -- ${r.selfFail}`);
    process.exit(2);
  }
  console.log(`root=${root}`);
  console.log(`scanned=${r.scanned}`);
  console.log(`required_docs=${REQUIRED_DOCS.length}`);
  console.log(`violations=${r.violations.length}`);
  for (const [file, line, why] of r.violations) {
    console.error(`  FAIL ${file}:${line} ${why}`);
  }
  if (r.violations.length > 0) {
    console.error("verdict=FAIL");
    process.exit(1);
  }
  console.log("verdict=PASS");
  process.exit(0);
}

function selftest() {
  const clean = [
    "# Title",
    "",
    "The `attested` tier guarantees a signed hardware report over the driver.",
    "",
    `Program \`${PROGRAM_ID}\` on \`${CLUSTER}\`.`,
    "",
    `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${CLUSTER}`,
    "",
  ].join("\n");

  const cases = [
    ["clean", clean, 0],
    ["wrong program id", clean.replace(PROGRAM_ID, "So11111111111111111111111111111111111111112"), 1],
    ["wrong cluster word", clean.replace(`on \`${CLUSTER}\``, "on `mainnet-beta`"), 1],
    ["explorer without cluster", clean.replace(`?cluster=${CLUSTER}`, ""), 1],
    ["truncated address", clean + "\nSee Eag1WgB...K6a7NS for details.\n", 1],
    ["ruled-out phrase", clean + "\nThis delivers fully verified AI to everyone.\n", 1],
    ["emoji", clean + "\nShipped \u{1F680} today.\n", 1],
    ["claim without a tier", "# Overview\n\nEvery output is verified before it reaches you.\n", 1],
  ];

  let ok = 0;
  let fail = 0;
  for (const [name, body, wantViolations] of cases) {
    const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require_fs();
    const dir = mkdtempSync(join(tmp(), "kortx-docs-"));
    mkdirSync(join(dir, "docs"), { recursive: true });
    // The required-document rule is not what these fixtures exercise; give each
    // fixture the full set so a single failing rule is the only variable.
    for (const doc of REQUIRED_DOCS) {
      writeFileSync(join(dir, doc), doc === "README.md" ? padded(body) : padded(clean));
    }
    const r = check(dir);
    rmSync(dir, { recursive: true, force: true });
    const got = r.violations.length;
    const pass = wantViolations === 0 ? got === 0 : got > 0;
    console.log(`  ${pass ? "ok  " : "FAIL"} ${name.padEnd(26)} violations=${got}`);
    if (!pass) {
      for (const v of r.violations) console.log(`         ${v.join(" ")}`);
      fail += 1;
    } else ok += 1;
  }
  console.log(`selftest ok=${ok} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

function padded(body) {
  return body + "\n" + Array.from({ length: MIN_LINES }, () => "Filler line that makes no claim.").join("\n") + "\n";
}
function require_fs() {
  return fsMod;
}
let fsMod;
let tmpDir;
function tmp() {
  return tmpDir;
}

const [{ mkdtempSync, writeFileSync, mkdirSync, rmSync }, { tmpdir }] = await Promise.all([
  import("node:fs"),
  import("node:os"),
]);
fsMod = { mkdtempSync, writeFileSync, mkdirSync, rmSync };
tmpDir = tmpdir();

if (process.argv.includes("--selftest")) selftest();
else report(ROOT);
