# M1-y-sweet part 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `xmesh` (XML documents on Yrs 0.28), the vector format and runner, the first hand-written vectors and feature files, the Yrs 0.19 cross-version probe and the fuzzer, all tested in CI.

**Architecture:** One plain tree type, `Node`, sits between everything: the XML parser produces it, `Xmesh` writes it into Yrs and reads it back, and the canonical writer consumes it. So canonical XML never touches Yrs, and the 0.19 probe reuses it by reading its own document into a `Node`. Vectors, replay and the convergence check live in `xmesh::vector`, so the runner test, the fuzzer and the probe share one implementation.

**Tech Stack:** Rust 2021, `yrs` 0.28.0, `quick-xml` 0.36, `serde`/`serde_json`, `sha2`, `hex`, `rand` 0.8 (`StdRng`, seeded), GitHub Actions.

**Spec:** [`2026-10-18-m1-y-sweet-part-1-design.md`](2026-10-18-m1-y-sweet-part-1-design.md). Code goes in `xtxp-link/xtxp-rs`, branch `m1-y-sweet`.

## Global Constraints

- `xmesh` is pure: no networking, file access, clocks or threads. File reading happens only in tests and tools.
- `yrs = "0.28.0"` in `xmesh`; `yrs019 = { package = "yrs", version = "=0.19.2" }` only in `tools/yrs-compat`.
- Every Yrs `Doc` is created with `skip_gc: true` and `offset_kind: OffsetKind::Utf16`.
- Client ID `0` is reserved for seeds; `Xmesh::new(0)` returns `Err(Error::ReservedClientId)`.
- XTXP namespace: `https://xtxp.link/ns`. Reserved tags: `{https://xtxp.link/ns}comment`, `{https://xtxp.link/ns}pi` (attribute `target`), `{https://xtxp.link/ns}cdata`.
- Fixed prefixes: SVG `http://www.w3.org/2000/svg` (default), `inkscape` `http://www.inkscape.org/namespaces/inkscape`, `sodipodi` `http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd`, `xlink` `http://www.w3.org/1999/xlink`, `xml` `http://www.w3.org/XML/1998/namespace` (never declared).
- Expanded names are written `{uri}local`, or `local` with no namespace.
- Hashes are lowercase hex. Document hash: SHA-256 of canonical XML. Snapshot hash: first 16 hex characters of SHA-256 of the canonical snapshot encoding.
- Public functions return `Result<_, xmesh::Error>`; no panics on bad input.
- Commits end with the session's attribution lines.

## Spec amendments made with this plan

Both are recorded in the spec as S9 and S10, for David's review:

- **S9, prolog and epilogue:** Inkscape writes a comment before `<svg>`. The fragment holds the root element plus any comments and processing instructions around it, in order. Paths start at the **root element**: `[]` is the root element, `[2]` its third child. Nodes outside the root element can't be edited in part 1.
- **S10, text offsets** in `insert_text` and `delete_text` count UTF-16 code units, as Yjs does, so the browser in M2 agrees. Yrs's default, UTF-8 bytes, could split a character.

## Review Focus

1. **A real Inkscape file as the seed:** an XML declaration, a comment before `<svg>`, `sodipodi:namedview`, `inkscape:` attributes and indentation. It should seed, and its canonical XML should keep the comment and the whitespace. Test: Task 2, `seed_real_inkscape_file`.
2. **Non-ASCII text:** `insert_text` at an offset after `é` or an emoji lands where a JS editor would put it. Test: Task 4, `insert_text_counts_utf16`.
3. **A failed batch:** a batch whose third operation has a bad path leaves the document unchanged and returns the error. Test: Task 4, `failed_batch_changes_nothing`.
4. **Escaping that round-trips:** `&`, `<` and `"` in attribute values and text, `>` left alone, and `]]>` inside CDATA. Test: Task 3, `escaping`.
5. **The same namespace under two prefixes:** `svg:rect` and `rect` in the default SVG namespace are the same expanded name and write out identically. Test: Task 1, `same_uri_two_prefixes`.

## File Structure

```
Cargo.toml                       workspace: crates/xmesh, tools/fuzzer, tools/yrs-compat
.github/workflows/ci.yml         fmt, clippy, test
crates/xmesh/src/lib.rs          module wiring, re-exports, Error
crates/xmesh/src/names.rs        namespace constants, expanded-name helpers
crates/xmesh/src/node.rs         Node, Element, parse_document, parse_fragment
crates/xmesh/src/canonical.rs    canonical(&[Node]) -> String, hash
crates/xmesh/src/doc.rs          Xmesh: new, seed, apply, state_vector, diff, tree
crates/xmesh/src/edit.rs         Op, Xmesh::edit, path resolution
crates/xmesh/src/snapshot.rs     Snapshot, canonical encoding, snapshot_hash, state_at
crates/xmesh/src/vector.rs       Vector, Expect, replay, check
crates/xmesh/tests/vectors.rs    runs check() on every vectors/*.json
crates/xmesh/tests/features.rs   @vector tags against vectors/
features/*.feature               Gherkin
vectors/*.json                   hand-written vectors
tools/fuzzer/src/{lib,main}.rs   generate(seed) -> Vector; CLI writes JSON
tools/yrs-compat/tests/compat.rs Yrs 0.19 replay of every vector
```

---

### Task 1: Workspace, `Node` and the XML parser

**Files:**
- Modify: `Cargo.toml` (members `crates/xmesh`, `tools/fuzzer`, `tools/yrs-compat`; workspace dep `yrs = "0.28.0"`)
- Create: `crates/xmesh/src/{lib,names,node}.rs`, `.github/workflows/ci.yml`
- Test: unit tests in `node.rs`

**Interfaces:**
- Produces:
  - `pub enum Node { Element(Element), Text(String) }`
  - `pub struct Element { pub name: String, pub attrs: Vec<(String, String)>, pub children: Vec<Node> }` (expanded names; `attrs` in source order)
  - `pub fn parse_document(xml: &str) -> Result<Vec<Node>, Error>`: exactly one root element, plus comments and PIs around it; XML declaration and DOCTYPE dropped
  - `pub fn parse_fragment(xml: &str) -> Result<Vec<Node>, Error>`: one or more nodes, with SVG as the default namespace and the fixed prefixes pre-bound
  - `pub enum Error { Xml(String), ReservedClientId, BadPath(Vec<u32>), NotAnElement(Vec<u32>), NotText(Vec<u32>), IndexOutOfRange(Vec<u32>, u32), MoveIntoSelf, Update(String), Vector(String) }` (implements `std::error::Error`)
  - `names::{XTXP_NS, SVG_NS, INKSCAPE_NS, SODIPODI_NS, XLINK_NS, XML_NS, COMMENT, PI, CDATA}` and `names::expand(uri: Option<&str>, local: &str) -> String`, `names::split(expanded: &str) -> (Option<&str>, &str)`

- [ ] **Step 1: Replace the scaffold.** Rewrite the workspace `Cargo.toml` per the file list, delete nothing else (only `Cargo.toml`, `.gitignore` and `crates/xmesh/Cargo.toml` exist). Add `ci.yml`: on push and pull request, `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
- [ ] **Step 2: Write failing tests** in `node.rs`:
  - `expanded_names`: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="…inkscape"><g inkscape:label="L"/></svg>` gives root name `{http://www.w3.org/2000/svg}svg` and child attr `("{http://www.inkscape.org/namespaces/inkscape}label", "L")`; no `xmlns` attributes stored.
  - `reserved_nodes`: `<a><!--c--><?t d?><![CDATA[x<y]]></a>` gives children `{XTXP}comment[Text("c")]`, `{XTXP}pi` with attrs `[("target","t")]` and `[Text("d")]`, `{XTXP}cdata[Text("x<y")]`.
  - `whitespace_kept`: `<a> <b/>\n</a>` gives children `[Text(" "), Element b, Text("\n")]`.
  - `prolog_comment`: `<?xml version="1.0"?><!-- Created --><svg/>` gives `[comment("Created"), svg]`.
  - `two_roots_rejected` and `malformed_rejected`: `Err(Error::Xml(_))`.
  - `fragment_has_default_svg`: `parse_fragment("<rect inkscape:label=\"x\"/>")` gives name `{SVG_NS}rect` and the inkscape attr.
  - `same_uri_two_prefixes` (Review Focus 5): `<svg xmlns="SVG" xmlns:svg="SVG"><svg:rect/><rect/></svg>` gives two children both named `{SVG_NS}rect`.
- [ ] **Step 3: Run** `cargo test -p xmesh` → the new tests fail to compile or fail.
- [ ] **Step 4: Implement** with `quick_xml::NsReader` (resolves prefixes for elements and attributes). Text is unescaped; entity references are resolved.
- [ ] **Step 5: Run** `cargo test -p xmesh` → PASS; `cargo clippy --workspace --all-targets -- -D warnings` → clean.
- [ ] **Step 6: Commit** `xmesh: Node tree and namespace-aware XML parser`.

### Task 2: `Xmesh` on Yrs: seed, sync and reading the tree

**Files:**
- Create: `crates/xmesh/src/doc.rs`
- Test: unit tests in `doc.rs`; fixture `crates/xmesh/tests/fixtures/inkscape-blank.svg` (a stock Inkscape 1.x blank document, as Inkscape saves it)

**Interfaces:**
- Consumes: `Node`, `Element`, `parse_document`, `Error` (Task 1)
- Produces:
  - `pub struct Xmesh` (owns a `yrs::Doc`; root fragment name `"xmesh"`)
  - `impl Xmesh { pub const SEED_CLIENT: u64 = 0; pub fn new(client_id: u64) -> Result<Xmesh, Error>; pub fn seed(xml: &str) -> Result<Vec<u8>, Error>; pub fn apply(&self, update: &[u8]) -> Result<(), Error>; pub fn state_vector(&self) -> Vec<u8>; pub fn diff(&self, state_vector: &[u8]) -> Result<Vec<u8>, Error>; pub fn tree(&self) -> Vec<Node>; pub fn client_id(&self) -> u64 }`
  - `pub(crate) fn write_nodes(txn, parent: &impl XmlFragment, index: u32, nodes: &[Node])` and `pub(crate) fn read_nodes(txn, parent: &impl XmlFragment) -> Vec<Node>`, used by Tasks 4 and 5

- [ ] **Step 1: Write failing tests:**
  - `seed_is_deterministic`: `Xmesh::seed(X)` twice gives identical bytes, for an `X` with 5 attributes on one element in non-sorted order.
  - `seed_round_trips`: after `new(7)` and `apply(seed(X))`, `tree() == parse_document(X)`.
  - `seed_twice_is_noop`: applying the seed twice gives the same `tree()` and `state_vector()` as once.
  - `reserved_client_refused`: `Xmesh::new(0)` is `Err(Error::ReservedClientId)`.
  - `diff_brings_peer_up_to_date`: peer B applies `A.diff(&B.state_vector())` and its `tree()` equals A's.
  - `bad_update_is_error`: `apply(&[0xff, 0xff])` is `Err(Error::Update(_))`.
  - `seed_real_inkscape_file` (Review Focus 1): the fixture seeds, `tree()[0]` is the prolog comment and `tree()[1]` is `{SVG_NS}svg`.
- [ ] **Step 2: Run** `cargo test -p xmesh doc::` → FAIL.
- [ ] **Step 3: Implement.** `Doc::with_options(Options { client_id, skip_gc: true, offset_kind: OffsetKind::Utf16, ..Default::default() })`. `write_nodes` inserts `XmlElementPrelim::empty(name)`, then attributes in order, then children recursively, and `XmlTextPrelim::new(text)` for text. `seed` writes `parse_document(xml)?` into a fresh client-0 doc in one transaction and returns `encode_state_as_update_v1(&StateVector::default())`. `apply` decodes with `Update::decode_v1` and maps both decode and `apply_update` errors to `Error::Update`.
- [ ] **Step 4: Run** `cargo test -p xmesh` → PASS.
- [ ] **Step 5: Commit** `xmesh: Xmesh document with deterministic seed and v1 sync`.

### Task 3: Canonical XML and the document hash

**Files:**
- Create: `crates/xmesh/src/canonical.rs`
- Test: unit tests in `canonical.rs`

**Interfaces:**
- Consumes: `Node`, `names` (Task 1); `Xmesh::tree` (Task 2)
- Produces: `pub fn canonical(nodes: &[Node]) -> String`, `pub fn hash_of(canonical: &str) -> String`, and `impl Xmesh { pub fn canonical(&self) -> String; pub fn hash(&self) -> String }`

- [ ] **Step 1: Write failing tests**, each asserting exact output strings:
  - `sorted_attrs`: attributes sort by (namespace URI, with no namespace as `""`, then local name). `<rect y="1" x="2" inkscape:label="a" xlink:href="#b"/>` under SVG gives `<rect x="2" y="1" inkscape:label="a" xlink:href="#b"/>`, because `""` < `http://www.inkscape…` < `http://www.w3.org/1999/xlink`.
  - `declarations_on_root`: `xmlns="…svg"` first, then the prefixed declarations actually used, sorted by prefix, and `xml:` never declared.
  - `unknown_namespaces_numbered`: two foreign namespaces get `ns1` and `ns2` in document order (element first, then its attributes in sorted order).
  - `empty_element_self_closes`: `<g/>`, never `<g></g>`.
  - `no_namespace_element`: an element with no namespace under SVG is written `<foo xmlns="">` (S5).
  - `reserved_written_back`: `<!--c-->`, `<?t d?>` and `<![CDATA[x<y]]>`, with their text unescaped, plus a prolog comment before the root with nothing between them.
  - `escaping` (Review Focus 4): text `a&b<c>d` gives `a&amp;b&lt;c>d`; attribute `"&<>` gives `&quot;&amp;&lt;>`; CDATA text containing `]]>` is written `<![CDATA[a]]]]><![CDATA[>b]]>`.
  - `hash_is_sha256_hex`: `hash_of("<a/>")` equals the SHA-256 hex of `<a/>` (64 lowercase hex characters).
- [ ] **Step 2: Run** `cargo test -p xmesh canonical::` → FAIL.
- [ ] **Step 3: Implement** in two passes: collect namespaces in document order to assign prefixes, then write.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `xmesh: canonical form v0 and document hash`.

### Task 4: Edits

**Files:**
- Create: `crates/xmesh/src/edit.rs`
- Test: unit tests in `edit.rs`

**Interfaces:**
- Consumes: `write_nodes`, `read_nodes` (Task 2); `parse_fragment` (Task 1); `Xmesh::canonical` (Task 3, in tests)
- Produces:
  - `#[derive(Serialize, Deserialize)] #[serde(tag = "op", rename_all = "snake_case")] pub enum Op { Insert { parent: Vec<u32>, index: u32, xml: String }, Remove { path: Vec<u32> }, SetAttr { path: Vec<u32>, name: String, value: String }, RemoveAttr { path: Vec<u32>, name: String }, InsertText { path: Vec<u32>, offset: u32, text: String }, DeleteText { path: Vec<u32>, offset: u32, len: u32 }, Move { path: Vec<u32>, new_parent: Vec<u32>, index: u32 } }`
  - `impl Xmesh { pub fn edit(&self, ops: &[Op]) -> Result<Vec<u8>, Error> }`: one transaction, returns its update
- Paths start at the root element (S9). In `name`, a fixed prefix (`inkscape:label`) or an expanded name (`{uri}local`) are both accepted and stored expanded. `Move.index` counts children of `new_parent` before the original is removed.

- [ ] **Step 1: Write failing tests:** one per operation, each checking `canonical()` afterwards, plus:
  - `move_reparents`: the moved node appears at the destination, its subtree intact, and is gone from the source.
  - `move_into_own_subtree_refused`: `Err(Error::MoveIntoSelf)`.
  - `bad_path`: `Err(Error::BadPath(_))`.
  - `text_op_on_element`: `Err(Error::NotText(_))`.
  - `insert_text_counts_utf16` (Review Focus 2): text `é😀z`, then `insert_text` at offset 3 (1 for `é` plus 2 for the emoji), gives `é😀Xz`.
  - `failed_batch_changes_nothing` (Review Focus 3): `[set_attr ok, set_attr ok, remove bad-path]` returns `Err`, and `state_vector()` and `canonical()` are unchanged.
  - `edit_returns_update`: applying the returned bytes to a synced peer reproduces the edit.
- [ ] **Step 2: Run** `cargo test -p xmesh edit::` → FAIL.
- [ ] **Step 3: Implement.** Make batches atomic by running them first on a scratch `Doc`: same client ID, loaded with `encode_state_as_update_v1` of the real doc, then thrown away. Only if every op succeeds there, run them on the real doc in one `transact_mut` and return `encode_diff_v1` against the state vector taken before.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `xmesh: edit operations as single atomic transactions`.

### Task 5: Snapshots

**Files:**
- Create: `crates/xmesh/src/snapshot.rs`
- Test: unit tests in `snapshot.rs`

**Interfaces:**
- Consumes: `Xmesh`, `Op`, `edit` (Tasks 2 and 4)
- Produces: `pub struct Snapshot(yrs::Snapshot)` with `pub fn encode_canonical(&self) -> Vec<u8>` and `pub fn hash(&self) -> String`; `impl Xmesh { pub fn snapshot(&self) -> Snapshot; pub fn snapshot_hash(&self) -> String; pub fn state_at(&self, snapshot: &Snapshot) -> Result<Vec<u8>, Error> }`

- [ ] **Step 1: Write failing tests:**
  - `encoding_layout`: a hand-built `yrs::Snapshot` with state `{5: 3, 2: 7}` and deletes `{5: [(0,1),(1,2)], 2: [(4,1)]}` encodes, as LEB128, to `[2, 2,7, 5,3, 2, 2,1, 4,1, 5,1, 0,3]`: client 5's two ranges merge to `(0,3)`.
  - `order_independent`: three peers each edit, then two fresh replicas receive all updates in opposite orders and get the same `snapshot_hash()`.
  - `delete_changes_hash`: removing a shape changes `snapshot_hash()`.
  - `state_at_keeps_later_deletes`: take a snapshot, remove a shape, apply `state_at(&snap)` to a fresh `Xmesh`, and the shape is still present.
- [ ] **Step 2: Run** `cargo test -p xmesh snapshot::` → FAIL.
- [ ] **Step 3: Implement.** Iterate `StateVector::iter` and `IdSet::iter`, then each client's `Ranges::iter`, collecting into sorted `Vec`s before writing. `state_at` uses `encode_state_from_snapshot` with `EncoderV1`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `xmesh: canonical snapshot encoding, snapshot hash and state_at`.

### Task 6: Vector format, replay, check and the runner

**Files:**
- Create: `crates/xmesh/src/vector.rs`, `crates/xmesh/tests/vectors.rs`, `vectors/concurrent-attr-same-key.json` (the spec's example, with `expect.canonical` computed and checked by hand)
- Test: unit tests in `vector.rs`, the integration test

**Interfaces:**
- Consumes: Tasks 2 to 5
- Produces:
  - `#[derive(Serialize, Deserialize)] pub struct Vector { pub name: String, pub description: String, pub seed: String, pub peers: BTreeMap<String, u64>, pub rounds: Vec<BTreeMap<String, Vec<Vec<Op>>>>, #[serde(default)] pub expect: Expect }`
  - `pub struct Expect { canonical: Option<String>, known_gap: Option<KnownGap>, snapshot: Option<SnapshotExpect>, fork: Option<ForkExpect> }`, with `KnownGap { reason: String, ideal_canonical: String }`, `SnapshotExpect { changes_after_round: usize }` and `ForkExpect { at_round: usize, canonical: String }`, all fields `pub`
  - `pub struct Replay { pub seed: Vec<u8>, pub updates: Vec<Vec<u8>>, pub snapshots: Vec<Snapshot> }`, where `snapshots[0]` is after the seed and `snapshots[n]` after round `n`
  - `pub fn replay(v: &Vector) -> Result<Replay, Error>`
  - `pub fn check(v: &Vector, orders: usize, rng_seed: u64) -> Result<(), Error>`, where `Error::Vector(msg)` names the vector, the order index and the RNG seed

- [ ] **Step 1: Write failing tests:**
  - `replay_counts_updates`: a 2-peer, 2-round vector with 3 batches gives 3 updates.
  - `check_passes_example`: `check` passes on the example vector.
  - `check_reports_wrong_canonical`: the same vector with a wrong `expect.canonical` returns `Err(Error::Vector(_))`.
  - `known_gap_that_closes_fails`: `ideal_canonical` equal to the real result returns `Err`.
  - In `tests/vectors.rs`, `all_vectors_pass`: every `vectors/*.json` passes `check(v, 200, 0)`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `replay` keeps one replica per peer and applies each round's batches with `edit`. After each round it syncs every replica to every other with `diff`, and records the snapshot. `check` builds a delivery list of seed plus updates, with each update also delivered a second time with probability 0.2. It applies that list to a fresh replica in `orders` shuffles from `StdRng::seed_from_u64(rng_seed)`. It asserts the same `hash()` and `snapshot_hash()` across all replicas, and that re-applying every update afterwards changes neither. Then it checks `expect`.
- [ ] **Step 4: Run** `cargo test -p xmesh` → PASS.
- [ ] **Step 5: Commit** `xmesh: vector format, replay and convergence check`.

### Task 7: The hand-written vectors and feature files

**Files:**
- Create: the 13 remaining vectors in the spec's section 4.4 table, as `vectors/<name>.json`; `features/{convergence,moves,snapshots,late-joiner,reconnect}.feature`; `crates/xmesh/tests/features.rs`

**Interfaces:**
- Consumes: `Vector`, `check` (Task 6)

- [ ] **Step 1: Write `tests/features.rs`:** `every_tag_has_a_vector` (each `@vector:<name>` names an existing file) and `every_vector_is_tagged`.
- [ ] **Step 2: Write the feature files.** Every scenario carries `@vector:<name>` or `@e2e`. The `late-joiner` and `reconnect` features are `@e2e` scenarios for part 2.
- [ ] **Step 3: Write the vectors.** Work out each `expect.canonical`, `known_gap.ideal_canonical`, snapshot or fork expectation by hand from the scenario, before running anything. Notes:
  - `concurrent-insert-same-position` and `concurrent-insert-index-0`: the order is Yrs's tie-break by client ID. Write down the order the scenario says, then run.
  - `deletes-out-of-order` needs no special format, because `check` already delivers in shuffled orders.
- [ ] **Step 4: Run** `cargo test -p xmesh` → PASS. A vector that fails on a Yrs behaviour is a **finding**: note it in the spec's findings section. Don't change the expectation to match unless the scenario itself was wrong.
- [ ] **Step 5: Commit** `vectors and features: first hand-written set`.

### Task 8: Cross-version probe (Yrs 0.19.2)

**Files:**
- Create: `tools/yrs-compat/{Cargo.toml,src/lib.rs,tests/compat.rs}`

**Interfaces:**
- Consumes: `replay`, `canonical`, `Node` (xmesh)
- Produces: `pub fn tree_019(doc: &yrs019::Doc) -> Vec<xmesh::Node>`, which reads the `"xmesh"` fragment with the 0.19 API

- [ ] **Step 1: Write the failing test** `every_vector_matches_on_019`: for each vector, apply `replay.seed` and every update to a 0.19 doc (`skip_gc: true`, `OffsetKind::Utf16`). Assert `canonical(&tree_019(&doc)) == xmesh_final.canonical()`, where `xmesh_final` is a 0.28 replica given the same updates.
- [ ] **Step 2: Run** → FAIL (no `tree_019`).
- [ ] **Step 3: Implement** `tree_019`.
- [ ] **Step 4: Run** → PASS, or each failing vector recorded as a finding (spec section 9) and marked `#[ignore = "finding: …"]` per vector. Mismatches are reported, never worked around.
- [ ] **Step 5: Commit** `yrs-compat: Yrs 0.19.2 cross-version probe`.

### Task 9: Fuzzer

**Files:**
- Create: `tools/fuzzer/{Cargo.toml,src/lib.rs,src/main.rs,tests/seeds.rs}`; modify `.github/workflows/ci.yml` only if the seed test needs `--release`

**Interfaces:**
- Consumes: `Vector`, `Op`, `Xmesh`, `check` (xmesh)
- Produces: `pub fn generate(seed: u64) -> Vector`, plus a CLI `xtxp-fuzzer <seed>` that prints the vector as JSON

- [ ] **Step 1: Write failing tests:**
  - `deterministic`: `generate(42)` serialised twice is equal.
  - `ops_are_valid`: `replay(&generate(s))` is `Ok` for seeds 0 to 49.
  - `seeds_converge`: `check(&generate(s), 20, s)` is `Ok` for seeds 0 to 499, and a failure prints the seed and the vector JSON.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with `StdRng::seed_from_u64(seed)`.
  - Use a fixed small SVG seed with a few shapes, a `g`, a `text` with `tspan`s and a comment.
  - 2 to 4 peers with client IDs 1 to 4, and 1 to 5 rounds of 1 to 3 batches of 1 to 4 ops.
  - Each op is chosen against the generating peer's own replica, which is advanced with `edit` as ops are generated. Every op is valid there.
  - Use every `Op` kind, attribute names from `fill`, `x`, `inkscape:label`, and short ASCII and non-ASCII text.
- [ ] **Step 4: Run** `cargo test -p xtxp-fuzzer` → PASS. Add `--release` in CI if the seed test takes more than 2 minutes in debug.
- [ ] **Step 5: Commit** `fuzzer: seeded vector generator, 500 seeds in CI`.

### Task 10: Branch check and push

- [ ] **Step 1:** `cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace` → all pass locally.
- [ ] **Step 2:** Push `m1-y-sweet`. Watch the GitHub Actions run until it's green, or fix and repeat.
- [ ] **Step 3:** Update the spec's section 9 with every finding from Tasks 7 to 9, and push `website` on its `m1-y-sweet` branch.
