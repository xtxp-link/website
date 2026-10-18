# M1-y-sweet, part 1: Xmesh and the vectors (design)

**Status:** design approved by David in conversation, 2026-10-18. This file is the written spec for his review; the implementation plan follows once he approves it.

## 1. Why this exists

After the [y-sweet review](2026-10-18-mvp-handover.md#6-step-0-review-y-sweet-before-any-hosting-code), David changed course: before building XTXP's own host, run **M1-y-sweet** and then **M2-y-sweet**, using a stock, unmodified y-sweet the way it is meant to be used. Afterwards he decides whether to build the full M1 and M2 as first planned.

The spike succeeds when it answers both:

- **Sessions and admission:** can y-sweet express "every connection edits in its own session and the host merges whole sessions" (decision 19)? If not, by how much does it fall short?
- **Operational feel:** setup, storage, reconnects and behaviour under a patchy network.

and when it gives **real people something real to use**. M1-y-sweet is CLI only: the first human is David, in a terminal on his own machine. Anything graphical or in a browser, including a friend watching changes arrive, is M2-y-sweet.

M1-y-sweet is split into two parts, each with its own spec, plan and build:

- **Part 1 (this file):** `xmesh`, the feature files and vectors, the vector runner, the cross-version probe and the fuzzer. No network.
- **Part 2:** the CLI peer (`replay`, `watch`, `edit`, `init`), y-sweet in CI and the chaos proxy. Designed separately.

## 2. Decisions in force for the spike

Decided by David during brainstorming on 2026-10-18. They hold for the spike and are reviewed afterwards; they are not yet in the spec site's decision log.

| # | Decision |
| --- | --- |
| S1 | Hosting for M1-y-sweet and M2-y-sweet is a stock y-sweet v0.9.1, commit `4f1909b2c3390ced54d32b82a673f4f7ee8ac780`, built from source in CI. Not modified. |
| S2 | Xmesh uses **Yrs 0.28**. y-sweet keeps its own Yrs 0.19.2. A cross-version probe (section 5) checks the two exchange updates correctly. |
| S3 | **Seed update:** a document starts from one seed update holding the whole initial drawing, made with a reserved client ID, byte-identical everywhere. No wrapper element. |
| S4 | Text is kept exactly as imported, whitespace-only text included. |
| S5 | Canonical form v0, plus: an element with no namespace is written with `xmlns=""` when the default namespace in scope is SVG. |
| S6 | **Snapshot hash:** SHA-256 over XTXP's own canonical snapshot encoding (section 3.6), shortened to 16 hex characters. How it is written after `@` stays open. |
| S7 | Reserved names for comments, processing instructions and CDATA are provisional (section 3.2) and reviewed after the spike. |
| S8 | Message framing (handover open point) is deferred to the full M1: y-sweet carries plain Yjs sync with no XTXP frames. |
| S9 | *Agreed by David.* Everything around the root element is kept, in order: comments, processing instructions, the XML declaration and the DOCTYPE (section 3.2). Paths start at the root element. |
| S10 | *Agreed by David.* Text offsets count UTF-16 code units, as JavaScript and Yjs do, so the M2 browser and M3 Wasm muppet can use cursor positions as they are. An offset inside a character (between the halves of a surrogate pair) rounds up to the next character boundary; for a delete, both ends round up. |

## 3. `xmesh`

A pure library: no networking, file access, clocks or threads. It depends on `yrs` 0.28, `sha2` and an XML parser.

### 3.1 Document

- An `Xmesh` wraps one Yrs `Doc`, with a client ID supplied by the caller and garbage collection off (`Options::skip_gc`, present in Yrs 0.28).
- The document is the Yrs XML fragment named `xmesh`. It holds the root element, such as `<svg>`, plus everything before or after it, in order: comments, processing instructions, the XML declaration and the DOCTYPE (S9). Whitespace between those top-level nodes is dropped.
- **Seed:** `Xmesh::seed(xml) -> Vec<u8>` imports `xml` into an empty `Doc` with client ID `0` and returns the update. Client ID `0` is reserved for seeds; `Xmesh::new` refuses it. Applying the same seed twice changes nothing. The importer keeps attribute order from the source and never iterates a hash map, so the seed bytes are deterministic; a test checks this across runs.

### 3.2 Data model

As on the [Math page](https://xtxp.link/spec/math/#data-model):

- An element's Yrs tag is its expanded name: `{namespace-uri}local`, or `local` with no namespace.
- An attribute's key is its expanded name in the same form. `xmlns` declarations are consumed while parsing and not stored.
- Text is a Yrs XML text node holding plain text, without formatting attributes.
- Provisional reserved names, in the namespace `https://xtxp.link/ns`:
  - a comment is an element `{https://xtxp.link/ns}comment` holding one text node
  - a processing instruction is `{https://xtxp.link/ns}pi`, with its target in the attribute `target` and its data in one text node
  - CDATA is `{https://xtxp.link/ns}cdata` holding one text node
- The XML declaration is an element `{https://xtxp.link/ns}xml-decl` with `version` and, if given, `standalone` as attributes. The encoding isn't kept: Xmesh always holds UTF-8.
- The DOCTYPE is an element `{https://xtxp.link/ns}doctype` holding its text verbatim, internal subset included.
- Entities declared in the DOCTYPE's internal subset (`<!ENTITY name "value">`) are expanded when parsing, also inside namespace declarations, as Illustrator files need. References inside comments, CDATA and processing instructions are left as they are. Parameter and external entities aren't supported.

### 3.3 Edits

Each call is one Yrs transaction and returns the update bytes it produced, so one action is one batch.

| Operation | Effect |
| --- | --- |
| `insert(parent, index, xml)` | Parses `xml` (one or more nodes) and inserts it under `parent` at `index` |
| `remove(path)` | Deletes the node and everything under it |
| `set_attr(path, name, value)` | Sets one attribute; last writer wins per attribute |
| `remove_attr(path, name)` | Removes one attribute |
| `insert_text(path, offset, text)` | Inserts into a text node |
| `delete_text(path, offset, len)` | Deletes from a text node |
| `move(path, new_parent, index)` | Inserts a copy at the destination and deletes the original, in one transaction (decision 20). `index` is counted before the original is removed. |

- A **path** is a list of child indexes among live children, starting at the root element: `[]` is the root element, `[2]` its third child (S9). Nodes outside the root element can't be edited in part 1.
- Text offsets count UTF-16 code units (S10). An offset inside a character rounds up to the next character boundary: an insert lands after the character, a delete ending inside one takes all of it, and a delete starting inside one starts after it.
- Errors, never panics: a path that doesn't resolve, an index out of range, XML that isn't well-formed, a text operation on an element, and a move into the node's own subtree.
- A moved node gets a new node ID. This is one of decision 20's known gaps.

### 3.4 Sync

- `state_vector() -> Vec<u8>`, `diff(state_vector) -> Vec<u8>` and `apply(update)`, all in Yrs's v1 encoding, which is what y-sweet speaks.
- Applying an update twice, or out of order, is allowed; Yrs holds updates whose dependencies haven't arrived.

### 3.5 Canonical XML and document hash

`canonical() -> String` writes [canonical form v0](https://xtxp.link/spec/math/#canonical-form-v0) exactly, plus:

- an element with no children is written `<name/>`
- every namespace declaration is written on the root element: the default namespace first, then prefixed ones sorted by prefix
- prefixes for namespaces outside the fixed list (`ns1`, `ns2` and so on) are numbered in document order: each element, then its attributes in sorted order
- the attributes of the `xml:` namespace use the prefix `xml` and are never declared
- an element with no namespace under SVG as the default namespace gets `xmlns=""` (S5)
- reserved elements are written back as `<!--…-->`, `<?target data?>`, `<![CDATA[…]]>` and `<!DOCTYPE …>`, their text unescaped; the XML declaration isn't written

`hash() -> String` is the SHA-256 of the canonical XML, as lowercase hex.

### 3.6 Snapshots

- `snapshot() -> Snapshot`: the state vector plus the delete set.
- **Canonical snapshot encoding:**
  1. the number of clients in the state vector, then each client ID and clock, sorted by client ID
  2. the number of clients in the delete set, then for each client, sorted by client ID: its number of ranges, then each range's start and length, with ranges sorted by start and overlapping or adjacent ranges merged

  All numbers are unsigned LEB128 variable-length integers.
- `snapshot_hash() -> String`: the first 16 lowercase hex characters of the SHA-256 of that encoding (S6).
- `state_at(snapshot) -> Vec<u8>`: an update that rebuilds the document as it was at the snapshot, using Yrs 0.28's `encode_state_from_snapshot`, which needs garbage collection off.

## 4. Feature files and vectors

### 4.1 Feature files

`features/*.feature`, in Gherkin, describe behaviour in words: `convergence`, `moves`, `snapshots`, `late-joiner` and `reconnect`. Each scenario is tagged with the vector that tests it (`@vector:<name>`) or with `@e2e` when it needs the network (part 2). They are not run with a Cucumber runner. A test checks that every `@vector` tag names a vector file and that every hand-written vector is named by a scenario.

### 4.2 Vector format

`vectors/<name>.json`:

```json
{
  "name": "concurrent-attr-same-key",
  "description": "Two peers set the same attribute at once; one value wins everywhere.",
  "seed": "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"1\"/></svg>",
  "peers": { "a": 1, "b": 2 },
  "rounds": [
    {
      "a": [[{ "op": "set_attr", "path": [0], "name": "fill", "value": "red" }]],
      "b": [[{ "op": "set_attr", "path": [0], "name": "fill", "value": "blue" }]]
    }
  ],
  "expect": {
    "canonical": "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle fill=\"blue\" r=\"1\"/></svg>"
  }
}
```

- `peers` maps peer names to fixed client IDs, so tie-breaks are reproducible. IDs are never `0`.
- `rounds`: within a round, each peer applies its batches (each an array of operations, applied as one transaction) to its own replica, concurrently with the others. Between rounds, every peer receives every update.
- `expect.canonical` is optional; generated vectors leave it out.
- `expect.known_gap`, for an expected failure: `{ "reason": "...", "ideal_canonical": "..." }`. The runner asserts that the result converges and **differs** from `ideal_canonical`. If it ever matches, the test fails, so the gap is noticed when it closes.
- `expect.snapshot`, optional: `{ "changes_after_round": n }` asserts the snapshot hash after round `n` differs from the one before.
- `expect.fork`, optional: `{ "at_round": n, "canonical": "..." }` rebuilds the document from the snapshot taken after round `n`, after later rounds have deleted content, and checks the rebuilt document's canonical XML.

### 4.3 Runner

A Rust integration test in `xmesh` that, for every vector:

1. replays the rounds to collect every update
2. delivers all updates to fresh replicas in 200 seeded shuffled orders, each with some updates delivered twice
3. asserts that every replica has the same document hash and the same snapshot hash, and that re-delivering any update changes neither
4. checks `expect`

Failures name the vector, the seed and the delivery order.

### 4.4 First hand-written vectors

| Vector | Checks |
| --- | --- |
| `concurrent-attr-same-key` | Last writer wins, the same everywhere |
| `concurrent-attr-different-keys` | Both attributes survive |
| `concurrent-insert-same-position` | Both inserts survive in one order |
| `concurrent-insert-index-0` | First-child inserts (the bug fixed in Yrs 0.27.3) |
| `edit-inside-deleted` | An edit inside a concurrently deleted element stays hidden |
| `tspan-whitespace` | Whitespace text between `tspan`s survives (S4) |
| `comment-pi-cdata` | Round trip of the reserved elements |
| `namespaced-attrs` | `inkscape:label`, `sodipodi:` and `xlink:href` prefixes and sorting |
| `no-namespace-element` | `xmlns=""` (S5) |
| `doctype-and-entities` | Declaration and DOCTYPE kept, DOCTYPE entities expanded (S9) |
| `deletes-out-of-order` | Deletes delivered before the inserts they delete (the bug fixed in Yrs 0.27.2) |
| `move-with-concurrent-edit` | Known gap: the edit lands on the original and is lost |
| `concurrent-moves-same-node` | Known gap: the node is duplicated |
| `delete-changes-snapshot` | Deleting a shape changes the snapshot hash |
| `fork-keeps-later-deletes` | A document rebuilt from an earlier snapshot keeps content deleted afterwards |

## 5. Cross-version probe

A test crate, `tools/yrs-compat`, depends on Yrs 0.19 renamed (`yrs019 = { package = "yrs", version = "=0.19.2" }`) alongside `xmesh`. For every vector it applies the seed and all updates, made by Xmesh on 0.28, to a 0.19 document, then writes that document's tree out with the same canonical rules and compares hashes with the 0.28 result. A mismatch is a finding for the spike, not something to work around.

## 6. Fuzzer

`tools/fuzzer` generates vectors from a numeric seed: 2 to 4 peers, 1 to 5 rounds, random operations that are valid against each peer's replica at that moment, drawn from all of section 3.3. It is deterministic for a given seed. Generated vectors carry no `expect.canonical`, so they check convergence only. CI runs seeds 0 to 499 through the runner; a failing seed is written out as a file and added to the hand-written vectors once understood.

## 7. Repository layout (part 1)

In `xtxp-link/xtxp-rs`, on branch `m1-y-sweet`:

```
crates/xmesh        the library, unit tests, and the vector runner (tests/vectors.rs)
tools/fuzzer        vector generator
tools/yrs-compat    cross-version probe
features/           Gherkin feature files
vectors/            hand-written vectors
```

The workspace keeps only these members until part 2 adds `crates/xtxp-cli` and `tools/chaos-proxy`. The scaffold commit already on the branch is replaced to match.

CI (GitHub Actions): `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test --workspace`, and the fuzzer's seed range.

## 8. Not in part 1

- Anything on the network: the CLI, y-sweet, the chaos proxy, done-when items 2 and 3.
- Done-when items 4 to 6 (key grants, session refusal, signed handshake), which y-sweet can't express. They are recorded as gaps in the spike's findings, not built.
- XML Patch import and export, identity, the wire crate and the host crate.

## 9. Findings to carry into the spike's write-up

- Yrs encodes state vectors and delete sets in hash-map order, so equal states can encode differently (Yrs 0.19.2 `state_vector.rs:125`, `id_set.rs:405`); hence S6.
- Yrs fixes after 0.19.2 that y-sweet lacks: delete set lost after applying an update (0.27.2), missing right neighbour on insert at index 0 (0.27.3), swallowed pending update (0.27.1), apply delete skipping blocks (0.26.0), decoder hardening (0.28.0).
- Yrs 0.27 removed its array move feature; XTXP never used it.
- "A fresh client ID per connection" (decision 19) conflicts with keeping unsent edits across a reconnect, because a Yrs `Doc` keeps one client ID for its life. Part 2 takes it as "per CLI process".

### Found while building part 1

- **Yrs 0.19.2, which y-sweet v0.9.1 runs, loses a delete that arrives before the insert it deletes.** Applied in the order they were made, every vector's Yrs 0.28 updates give identical XML on 0.19.2. In shuffled orders, 6 of 14 vectors diverge on 0.19.2, with deleted content coming back (`tools/yrs-compat`, test `finding_019_loses_a_delete_that_arrives_first`). y-sweet's hub topology mostly delivers causally, since a peer only sees content through the host, but the full design's sessions, forks and merges would hit it.
- **Yrs 0.28.0 can leave a pending update stuck.** Fuzz seed 0 found an order of 8 valid updates from four clients after which Yrs still reports missing updates, although everything has arrived; delivering again heals it (`tools/fuzzer`, test `finding_yrs_028_leaves_a_pending_update_stuck`). Xmesh works around it: `apply` keeps any update that leaves the document with missing dependencies and re-applies those after later updates, which is idempotent. The real sync protocol would also heal it at the next state-vector exchange. Worth reporting upstream.
- **The parser rejected files whose DOCTYPE declares entities**, as Illustrator exports do. Fixed with S9: such entities are now expanded.
- **Yrs 0.28 shifts a text delete that starts inside a surrogate pair** one unit right, keeping its length, so it deletes a character the client never covered, and panics when the shifted range runs past the end. Inserts and delete ends inside a pair are rounded up correctly. Xmesh rounds both ends itself before calling Yrs (S10). Worth reporting upstream alongside the stuck pending update.
- **Yrs 0.28 keeps an element's attributes in a hash map**, so source order is lost; `tree()` returns them in canonical order.
- **A batch can't be rolled back in Yrs**, so `edit` tries it on a throwaway copy first.
- **Yrs 0.28 client IDs are 53-bit**, checked only by a debug assertion; Xmesh refuses larger ones. (Part 2 lowered the limit to 32 bits, because y-sweet's Yrs 0.19.2 reads client IDs as 32-bit: see part 2's design, section 10.)
