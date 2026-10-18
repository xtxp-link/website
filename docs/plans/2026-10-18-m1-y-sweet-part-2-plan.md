# M1-y-sweet part 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put Xmesh on the network against a stock y-sweet. Build `xtxp-wire` (the peer side of the Yjs sync protocol), `xtxp-muppet` (a hexagonal muppet with a TUI and one-shot commands), the chaos proxy, end-to-end tests, a CI job and a macOS try-it script.

**Architecture:** Three layers, each depending only on the one below:
- `xmesh` merges.
- `xtxp-wire` is a pure state machine that turns frames and edits into frames and events.
- `xtxp-muppet`'s core is a synchronous application service. Its driven ports (`Transport`, `Clock`, `IdSource`, `View`) are traits, and adapters call its driving methods (`on_connected`, `on_frame`, `on_tick`, `command`).

Only the binary's adapters use tokio, the network, the terminal or randomness. Core tests use an in-memory transport wired to `xtxp-wire`'s fake host.

**Tech Stack:**
- Rust 2021, `yrs` 0.28 (`yrs::sync` encoding), `ratatui` 0.30 with `crossterm` 0.29.
- `tokio` 1 and `tokio-tungstenite` 0.30.
- `reqwest` 0.13 with `default-features = false` and `json`.
- `clap` 4 (derive), `rand` 0.8, `serde_json`.

**Spec:** [`2026-10-18-m1-y-sweet-part-2-design.md`](2026-10-18-m1-y-sweet-part-2-design.md) (decisions P1 to P9). Code goes in `xtxp-link/xtxp-rs`, on branch `m1-y-sweet-part-2`.

## Global Constraints

- `xmesh`, `xtxp-wire` and `xtxp-muppet`'s `core` module do no I/O, read no clock, start no threads and use no randomness. Only `xtxp-muppet/src/adapters/` and `src/main.rs` may.
- **y-sweet:** commit `4f1909b2c3390ced54d32b82a673f4f7ee8ac780`, run as `y-sweet serve <dir> --port <p> --skip-gc --checkpoint-freq-seconds 1`.
  - Without `--skip-gc`, a late joiner's snapshot wouldn't match the peers' (decision 19 needs GC off everywhere).
  - The 1 s checkpoint is what makes the restart test meaningful.
- **No auth (P2).** Documents are created with `POST http://{server}/doc/new` and body `{"docId": NAME}`. The WebSocket is `ws://{server}/d/{NAME}/ws/{NAME}`. One sync message per binary frame.
- **Custom message tag 102** (`SYNC_STATUS`) is y-sweet's echo; its payload is a little-endian `u64` counter.
- **Client IDs** are random in `1..2^53`, and a fresh one is drawn for every connection (P1).
- **Reconnect backoff:** 100 ms, doubling, capped at 5 s, plus 0 to 20% jitter. It resets after a connection reaches `Synced`.
- **`replay`:** gaps of 0 to 50 ms between batches, and done after `LocalAcked` plus 500 ms without a remote update.
- **Paths** in op words are written `/` (root element) and `0/2`. Attribute names follow `xmesh::Op`'s rules.
- **The note text (P6):** `tree changed since shown (@{old16} → @{new16}); applied to the current tree`, using the 16-hex snapshot hashes.
- **Commits** end with the session's attribution lines. Run `cargo fmt --all` before every commit.

## Spec amendments made with this plan

Recorded in the spec's section 8.1:
- y-sweet is started with `--skip-gc --checkpoint-freq-seconds 1`, as above.

## Review Focus

1. **A selection on a node deleted remotely while you're editing its attribute.** Pressing Enter must not panic or edit something else: the edit is dropped with a status line, and the selection moves to the nearest live ancestor. Test: Task 5, `edit_of_node_deleted_meanwhile_is_dropped`.
2. **A y-sweet that isn't running.** `open` shows `○ reconnecting` and keeps retrying, while `edit` and `show` retry for 10 s and then exit non-zero with a clear message, not a stack trace. Test: Task 6, `one_shot_without_server_fails_cleanly`.
3. **Non-ASCII text edited in the TUI.** Editing `héllo 😀` to `héllo 😀!` sends a single `insert_text` at UTF-16 offset 8. Test: Task 5, `set_text_diffs_in_utf16`.
4. **`init` on a document that already has content.** It refuses and changes nothing. Tests: Task 4, `init_refuses_existing_content` (core), and Task 9, `init_refuses_existing_content` (end-to-end).
5. **A frame y-sweet sends that `xtxp-wire` doesn't know,** such as awareness or auth. It's ignored, with no `ProtocolError` and no reconnect loop. Test: Task 3, `unknown_messages_ignored`.

## File Structure

```
Cargo.toml                                   members + crates/xtxp-wire, crates/xtxp-muppet, tools/chaos-proxy
crates/xmesh/src/ids.rs                      NodeId, IdNode, tree_with_ids, path_of
crates/xtxp-wire/src/lib.rs                  Peer, Input, Output, Event, SYNC_STATUS
crates/xtxp-wire/src/fake_host.rs            FakeHost (feature "fake-host")
crates/xtxp-muppet/src/lib.rs                pub mod core; pub mod ports; pub mod ops_words; pub mod adapters
crates/xtxp-muppet/src/ports.rs              Transport, Clock, IdSource, View, Screen, Outcome
crates/xtxp-muppet/src/core.rs               Muppet, Mode, Command
crates/xtxp-muppet/src/ops_words.rs          parse "set-attr 0 fill red" → xmesh::Op
crates/xtxp-muppet/src/adapters/ws.rs        tokio WebSocket transport + reconnect timing driver
crates/xtxp-muppet/src/adapters/ysweet.rs    POST /doc/new, URLs
crates/xtxp-muppet/src/adapters/cli.rs       init, edit, show, replay
crates/xtxp-muppet/src/adapters/tui/{mod,model,render,keys}.rs
crates/xtxp-muppet/src/main.rs               clap entry point
crates/xtxp-muppet/tests/support/mod.rs      spawn y-sweet, proxy, muppets
crates/xtxp-muppet/tests/e2e.rs              the four end-to-end tests
tools/chaos-proxy/src/{lib,main}.rs
tools/fuzzer/src/lib.rs                      + generate_single_round
.github/workflows/ci.yml                     + e2e job
scripts/try-it.sh, README.md
```

---

### Task 1: Xmesh node IDs

**Files:**
- Create: `crates/xmesh/src/ids.rs`
- Modify: `crates/xmesh/src/lib.rs` (export)

**Interfaces:**
- Produces:
  - `#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)] pub struct NodeId { pub client: u64, pub clock: u32 }`
  - `#[derive(Debug, Clone, PartialEq)] pub struct IdNode { pub id: NodeId, pub node: IdNodeKind }`
  - `pub enum IdNodeKind { Element { name: String, attrs: Vec<(String, String)>, children: Vec<IdNode> }, Text(String) }`
  - `impl Xmesh { pub fn tree_with_ids(&self) -> Vec<IdNode>; pub fn path_of(&self, id: NodeId) -> Option<Vec<u32>> }`
- `NodeId` comes from `XmlOut::id()`'s `BranchID::Nested(ID)`. `path_of` is relative to the root element, the same paths `Op` uses, and gives `None` for deleted nodes and nodes outside the root element.

- [ ] **Step 1: Write failing tests** in `ids.rs`:
  - `ids_are_stable_across_replicas`: two replicas given the same updates report equal `tree_with_ids()`.
  - `tree_with_ids_matches_tree`: dropping the IDs gives exactly `tree()`.
  - `path_follows_node_after_insert_above`: after `insert(parent [], index 0)`, the `path_of` the old `[0]` is `[1]`.
  - `path_of_deleted_is_none`.
  - `path_of_root_is_empty`.
  - `ids_differ_per_node`: all IDs in a tree are distinct.
- [ ] **Step 2: Run** `cargo test -p xmesh ids::` → FAIL (compile).
- [ ] **Step 3: Implement** by walking like `read_nodes`, but keeping `XmlOut::id()`.
- [ ] **Step 4: Run** `cargo test -p xmesh` → PASS.
- [ ] **Step 5: Commit** `xmesh: node IDs in the tree, and path_of`.

### Task 2: Single-round fuzz vectors

**Files:**
- Modify: `tools/fuzzer/src/lib.rs`, `tools/fuzzer/src/main.rs` (`--single-round`), `tools/fuzzer/tests/seeds.rs`

**Interfaces:**
- Produces: `pub fn generate_single_round(seed: u64) -> Vector`: 3 peers (client IDs 1 to 3), one round, each peer with 2 to 6 batches, generated against its own replica from the seed only.
- `generate(seed)` must produce byte-identical JSON to before. That's checked by `seed_0_is_unchanged`, which compares against a golden hash taken before the change.

- [ ] **Step 1: Write failing tests:**
  - `seed_0_is_unchanged`: the SHA-256 of `generate(0).to_json()` equals the value recorded before editing.
  - `single_round_shape`: 3 peers, 1 round, 2 to 6 batches each.
  - `single_round_seeds_converge`: `check(&generate_single_round(s), 20, s)` passes for seeds 0 to 99.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** by sharing `random_op` with `generate`, using a separate RNG stream so `generate` is untouched.
- [ ] **Step 4: Run** `cargo test --release -p xtxp-fuzzer` → PASS.
- [ ] **Step 5: Commit** `fuzzer: single-round vectors for separate processes`.

### Task 3: `xtxp-wire`

**Files:**
- Create: `crates/xtxp-wire/{Cargo.toml,src/lib.rs,src/fake_host.rs}`, with `[features] fake-host = []`
- Test: unit tests in `lib.rs`, using `FakeHost`

**Interfaces:**
- Consumes: `xmesh::{Xmesh, Op, Error}`, and `Xmesh::diff`, `state_vector`, `apply`, `hash`, `snapshot_hash`
- Produces:
  - `pub const SYNC_STATUS: u8 = 102;`
  - `pub enum Input { Connected, Disconnected, Frame(Vec<u8>), Edit(Vec<Op>), Reconnect(u64) }`
  - `pub enum Output { Send(Vec<u8>), Event(Event) }`
  - `pub enum Event { RemoteUpdate { before: String, after: String }, Synced, LocalAcked, EditFailed(xmesh::Error), ProtocolError(String) }`, where `before` and `after` are snapshot hashes
  - `pub struct Peer`, with:
    - `pub fn new(client_id: u64) -> Result<Peer, xmesh::Error>`
    - `pub fn handle(&mut self, input: Input) -> Vec<Output>`
    - `pub fn doc(&self) -> &Xmesh`
    - `pub fn is_connected(&self) -> bool`
    - `pub fn is_synced(&self) -> bool`
    - `pub fn unacked(&self) -> bool`
    - `pub fn updates_before_synced(&self) -> u32`
  - Behind `fake-host`: `pub struct FakeHost` with:
    - `pub fn new() -> FakeHost`
    - `pub fn connect(&mut self) -> (ConnId, Vec<Vec<u8>>)`, returning the frames y-sweet sends on connect: its step 1 plus an empty awareness update
    - `pub fn receive(&mut self, conn: ConnId, frame: &[u8]) -> Vec<(ConnId, Vec<u8>)>`
    - `pub fn disconnect(&mut self, conn: ConnId)`
    - `pub fn doc_hash(&self) -> String`
  - `FakeHost` mirrors y-sweet v0.9.1's `DocConnection::handle_msg`: it answers step 1 with step 2, applies step 2 and updates and relays them to other connections, echoes 102, and ignores awareness.

**Peer rules:**
- **On `Connected`:** send step 1 with its state vector.
- **On the host's step 1:** reply with step 2, `doc.diff(host_sv)`, then 102 with the next counter.
- **On the host's step 2:** apply it, count it in `updates_before_synced`, and emit `RemoteUpdate` if the snapshot hash changed.
- **`Synced`** is emitted once the host's step 2 has been applied and the 102 sent after our step 2 has come back.
- **On `Update`:** apply it, emit `RemoteUpdate` if the snapshot changed, and count it if not yet synced.
- **On `Edit(ops)`:** `doc.edit`. If that fails, emit `EditFailed`. If connected, send `Update` plus 102. If disconnected, don't send: the next step 2 carries it.
- **On a 102 echo:** when the counter equals the last sent, set unacked to false and emit `LocalAcked`.
- **On `Reconnect(id)`:** make a new `Xmesh::new(id)`, apply `old.diff(&empty_state_vector)`, and reset the sync state.
- **On an undecodable frame** or an apply error: `ProtocolError`. Awareness, auth and unknown custom tags are ignored.

- [ ] **Step 1: Write failing tests:**
  - `two_peers_converge_through_fake_host`
  - `late_joiner_gets_one_update`: `updates_before_synced() == 1` and the hashes are equal
  - `edit_is_acked`: `LocalAcked` follows an `Edit` once the 102 echo returns
  - `offline_edit_survives_reconnect`: disconnect, edit, `Reconnect(new_id)`, connect, and the host's hash equals the peer's; the edit's node ID still has the old client ID
  - `duplicate_frames_change_nothing`
  - `garbage_frame_is_protocol_error`
  - `unknown_messages_ignored` (Review Focus 5): an awareness frame, an auth frame and a custom tag 7 give no `ProtocolError`
  - `edit_failure_reported`: a bad path gives `EditFailed`
- [ ] **Step 2: Run** `cargo test -p xtxp-wire --features fake-host` → FAIL.
- [ ] **Step 3: Implement** with `yrs::sync::{Message, SyncMessage}`, `yrs::updates::{encoder::Encode, decoder::Decode}` and `StateVector::decode_v1` for the host's step 1. Encode the 102 payload as `u64::to_le_bytes`.
- [ ] **Step 4: Run** → PASS, plus clippy.
- [ ] **Step 5: Commit** `xtxp-wire: peer side of the Yjs sync protocol, with a fake y-sweet host`.

### Task 4: Muppet ports and core, without UI logic

**Files:**
- Create: `crates/xtxp-muppet/{Cargo.toml,src/lib.rs,src/ports.rs,src/core.rs,src/ops_words.rs}`. The library has no tokio, ratatui or crossterm dependency. Those go behind the `bin` adapters in Task 6 and Task 7, using a `[features] adapters` default feature, so the core can be built without them.
- Test: unit tests in `core.rs`, `ops_words.rs`; test utilities in `src/core/testkit.rs` (`#[cfg(test)]`): `MemTransport` connected to `FakeHost`, `FakeClock`, `SeqIds`, `RecordingView`

**Interfaces:**
- Consumes: `xtxp_wire::{Peer, Input, Output, Event}`, `xmesh::{Op, NodeId, IdNode}`
- Produces:
  - `pub trait Transport { fn connect(&mut self); fn send(&mut self, frame: Vec<u8>); fn close(&mut self); }`
  - `pub trait Clock { fn now_ms(&self) -> u64; }`
  - `pub trait IdSource { fn next_client_id(&mut self) -> u64; }`
  - `pub trait View { fn show(&mut self, screen: &Screen); fn status(&mut self, line: &str); fn finished(&mut self, outcome: &Outcome); }`
  - `pub struct Screen { pub tree: Vec<IdNode>, pub snapshot_hash: String, pub doc_hash: String, pub connected: bool, pub changed: Vec<NodeId> }`
  - `pub struct Outcome { pub ok: bool, pub doc_hash: String, pub snapshot_hash: String, pub updates_before_synced: u32, pub canonical: String, pub message: Option<String> }`
  - `pub enum Mode { Interactive, Edit(Vec<Op>), Show, Replay { batches: Vec<Vec<Op>>, gaps_ms: Vec<u64> }, Init { seed: Vec<u8> } }`
  - `pub struct Muppet<T: Transport, C: Clock, I: IdSource, V: View>`, with:
    - `pub fn new(mode: Mode, t: T, c: C, i: I, v: V) -> Muppet<…>`, which calls `t.connect()`
    - `pub fn on_connected(&mut self)`
    - `pub fn on_frame(&mut self, frame: Vec<u8>)`
    - `pub fn on_disconnected(&mut self)`
    - `pub fn on_tick(&mut self)`, called by adapters at least every 50 ms
    - `pub fn screen(&self) -> &Screen`
    - `pub fn is_finished(&self) -> bool`
  - `pub fn parse_op_words(words: &[String]) -> Result<Op, String>` (in `ops_words`)

**Core rules:**
- Every `Peer` output goes to the `Transport` or the `View`.
- **Disconnects:** `on_disconnected` schedules a reconnect at `now + backoff`. When that time passes, `on_tick` calls `Peer::handle(Reconnect(ids.next_client_id()))` and `t.connect()`.
- **The modes:**
  - `Edit` applies its ops once `Synced`, then finishes `ok` at `LocalAcked`.
  - `Show` finishes at `Synced`.
  - `Init` finishes with `ok: false` and a message if the synced tree isn't empty. Otherwise it applies the seed and finishes at `LocalAcked`.
  - `Replay` applies `batches[k]` when `now >= start + sum(gaps[..=k])`, whether or not connected. It finishes when all are applied, nothing is unacked, it's synced, and 500 ms have passed since the last `RemoteUpdate`.
  - `Interactive` never finishes.
- **One-shot timeout:** if not `Synced` within 10 s of the first connect, the one-shot modes finish with `ok: false` and the message `could not reach y-sweet at …`.

- [ ] **Step 1: Write failing tests:**
  - `ops_words` tests: one per op word, plus bad input.
  - `two_muppets_converge` (interactive).
  - `edit_mode_finishes_after_ack`.
  - `show_mode_reports_updates_before_synced`.
  - `init_refuses_existing_content`.
  - `replay_applies_on_schedule_and_finishes_quietly`: the fake clock is advanced in steps.
  - `reconnects_with_backoff_and_fresh_id`: disconnect, tick to 99 ms with no connect, tick to 100 ms, and it connects with the next `SeqIds` value.
  - `one_shot_times_out`: no host answer, and at 10 s it finishes `ok: false`.
- [ ] **Step 2: Run** `cargo test -p xtxp-muppet --no-default-features` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `xtxp-muppet: hexagonal core with ports, modes and reconnect`.

### Task 5: Interactive commands in the core

**Files:**
- Modify: `crates/xtxp-muppet/src/core.rs`

**Interfaces:**
- Produces:
  - `pub enum Command { SetAttr { node: NodeId, name: String, value: String }, RemoveAttr { node: NodeId, name: String }, SetText { node: NodeId, text: String }, Delete { node: NodeId }, InsertChild { parent: NodeId, xml: String }, Move { node: NodeId, new_parent: NodeId }, Seen }`
  - `impl Muppet { pub fn command(&mut self, cmd: Command) }`
  - `Seen` records the snapshot hash the user was last shown.

**Command rules:**
- Resolve each `NodeId` with `doc().path_of` at the moment the command is handled.
  - If it's `None`: drop the edit with a status line naming the node and saying it was deleted (Review Focus 1). The adapter then moves the selection.
- If the current snapshot hash differs from the one last `Seen`, emit the P6 note before applying.
- **`SetText`:** take the common prefix and suffix of the old and new text in UTF-16 units, and emit at most one `DeleteText` and one `InsertText` in one batch.
- **`Move`:** inserts the node as `new_parent`'s first child, at index 0.
- `Screen.changed` holds the IDs whose node content differs from the previous screen. It's cleared on the next `show`.

- [ ] **Step 1: Write failing tests:**
  - `set_attr_on_node_after_remote_insert_above` (P7): node *X* at `[0]`, a remote insert at `[0]` arrives, then `SetAttr { node: X }` edits the node now at `[1]`.
  - `edit_of_node_deleted_meanwhile_is_dropped` (Review Focus 1).
  - `note_when_tree_changed_since_seen` (P6): asserts the exact note text.
  - `no_note_when_unchanged`.
  - `set_text_diffs_in_utf16` (Review Focus 3).
  - `changed_lists_remote_edits`.
  - `move_makes_first_child`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cargo test -p xtxp-muppet --no-default-features` → PASS.
- [ ] **Step 5: Commit** `xtxp-muppet: interactive commands by node ID, with the changed-tree note`.

### Task 6: Adapters, the one-shot commands and the binary

**Files:**
- Create: `crates/xtxp-muppet/src/adapters/{mod,ws,ysweet,cli}.rs`, `crates/xtxp-muppet/src/main.rs`
- Test: `crates/xtxp-muppet/tests/cli_args.rs`, and unit tests in `ysweet.rs` and `ws.rs`

**Interfaces:**
- Consumes: `Muppet`, the ports and `parse_op_words` (Tasks 4 and 5)
- Produces:
  - The binary `xtxp-muppet`, with subcommands `init <file> [--doc NAME]`, `open <doc> [--read-only]`, `edit <doc> <op words…>` (several ops separated by `,`), `show <doc> [--canonical|--tree|--hashes]` and `replay <vector.json> --peer NAME [--seed N]`. Every subcommand takes `--server HOST:PORT`, defaulting to `localhost:8080`.
  - `adapters::ysweet::{create_doc(server, name) -> Result<(), String>, ws_url(server, name) -> String}`
  - `adapters::ws::run<V: View>(mode, server, doc, view) -> Outcome`: a tokio runtime with one task for the socket, and a select loop over socket events, a 50 ms tick and, for the TUI, input events. It drives `Muppet`.
  - `SystemClock`, a monotonic `now_ms`, and `RandomIds`, random in `1..2^53`.

**One-shot output:**
- `--hashes` prints `{"doc_hash":…,"snapshot_hash":…,"updates_before_synced":…}` on one line.
- `edit` prints the same JSON.
- Exit status is 0 if `ok`, otherwise 1, with the message on stderr.

- [ ] **Step 1: Write failing tests:**
  - `ws_url_shape`.
  - `create_doc_body`, against a local hyper-free `TcpListener` stub that records one request.
  - In `cli_args.rs`, clap parsing for each subcommand.
  - `one_shot_without_server_fails_cleanly` (Review Focus 2): run the built binary's `show demo --server 127.0.0.1:1`, then assert exit status 1 within 15 s and that stderr contains `could not reach y-sweet`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cargo test -p xtxp-muppet` → PASS.
- [ ] **Step 5: Manual check against the y-sweet built in the container:**
  - `y-sweet serve /tmp/ys --port 8080 --skip-gc --checkpoint-freq-seconds 1 &`
  - `xtxp-muppet init crates/xmesh/tests/fixtures/inkscape-blank.svg --doc demo`
  - `xtxp-muppet edit demo set-attr 2 fill red`, then `xtxp-muppet show demo --canonical` contains `fill="red"`.
  - Record the commands and their output in the ledger.
- [ ] **Step 6: Commit** `xtxp-muppet: WebSocket and y-sweet adapters, one-shot commands`.

### Task 7: The TUI

**Files:**
- Create: `crates/xtxp-muppet/src/adapters/tui/{mod,model,render,keys}.rs`

**Interfaces:**
- Consumes: `Screen`, `Command`, `Muppet::command`
- Produces:
  - `tui::Model` holds selection by `NodeId`, folded nodes, the input mode (`Browse`, `AttrList`, `EditValue { target, buffer }`, `AddAttrName`, `AddAttrValue`, `InsertXml`, `MovePending(NodeId)`) and the status line.
  - `tui::keys::handle(model: &mut Model, screen: &Screen, key: KeyEvent) -> Vec<Command>` is pure.
  - `tui::render::draw(frame, model, screen)` lays out the header, tree pane, detail pane and status line as in spec section 6.4.
  - `TuiView` implements `View` by updating the shared `Screen` and status and requesting a redraw.

**Rules:**
- After each `show`, a selection whose `NodeId` is gone moves to its nearest live ancestor, using the previous screen's parent links, with a status line.
- Changed nodes are highlighted until 1 s after the screen that marked them.
- Keys follow spec section 6.4: Enter, `a`, `x`, `d`, `i`, `m`, Esc, `q`, ↑/↓/←/→. Each `Command` is preceded by `Command::Seen` carrying the snapshot hash the user was looking at.
- `--read-only` ignores the editing keys and says so in the status line.

- [ ] **Step 1: Write failing tests:**
  - in `keys.rs`: `enter_on_element_opens_attr_list`, `edit_value_then_enter_sends_set_attr`, `esc_cancels`, `d_sends_delete`, `m_then_m_sends_move`, `read_only_ignores_edits`, `selection_moves_to_ancestor_when_deleted`;
  - in `render.rs`, with `ratatui::backend::TestBackend` at 80×24: `draws_header_tree_detail_status`, asserting the header holds the 16-hex snapshot hash and `● live`, and the tree holds `rect` with its id.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Wire `open` in `main.rs` to `ws::run` with the TUI loop, using crossterm's raw mode and alternate screen, restored on exit and on panic.
- [ ] **Step 4: Run** `cargo test -p xtxp-muppet` → PASS.
- [ ] **Step 5: Commit** `xtxp-muppet: TUI with node-ID selection and live redraw`.

### Task 8: Chaos proxy

**Files:**
- Create: `tools/chaos-proxy/{Cargo.toml,src/lib.rs,src/main.rs,tests/proxy.rs}`

**Interfaces:**
- Produces:
  - `pub struct Chaos { pub seed: u64, pub delay_ms: u64, pub dup: f64, pub drop: f64 }`
  - `pub async fn serve(listen: SocketAddr, upstream: SocketAddr, chaos: Chaos) -> std::io::Result<()>`
  - The binary `chaos-proxy --listen A --upstream B --seed N --delay-ms D --dup P --drop Q`.

**Rules:**
- **For each accepted TCP connection,** read the HTTP request head.
  - **If it's a WebSocket upgrade:** accept it with `tokio_tungstenite::accept_hdr_async`, replaying the buffered head, and open `connect_async(ws://upstream{path})`. Forward binary frames both ways through a per-direction queue that delays each frame by a random 0 to `delay_ms` while keeping order. Duplicate with probability `dup`. With probability `drop`, close both sides, forwarding that frame first half the time.
  - **Otherwise:** write the head upstream and `copy_bidirectional`.
- The RNG is `StdRng::seed_from_u64(seed ^ connection_number)`.
- Log `conn {n} dup frame {k}` and `conn {n} drop after frame {k} (forwarded|lost)` to stderr.

- [ ] **Step 1: Write failing tests** in `tests/proxy.rs`, with a tokio WebSocket echo upstream and fixed seeds:
  - `order_kept_under_delay`;
  - `duplicates_arrive`;
  - `drop_closes_both_sides`;
  - `plain_http_passes_through`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cargo test -p chaos-proxy` → PASS.
- [ ] **Step 5: Commit** `chaos-proxy: delays, duplicates and dropped connections`.

### Task 9: End-to-end tests

**Files:**
- Create: `crates/xtxp-muppet/tests/support/mod.rs`, `crates/xtxp-muppet/tests/e2e.rs`
- Modify: `features/late-joiner.feature`, `features/reconnect.feature` (name the tests)

**Interfaces:**
- Consumes: the binaries from Tasks 6 and 8, `generate_single_round` (Task 2), `xmesh::vector::check`
- Produces, in `support`:
  - `ysweet_bin() -> Option<PathBuf>`: `YSWEET_BIN`, then `.tools/bin/y-sweet`, then `None`
  - `YSweet::start(dir) -> YSweet`, on a free port, with the Global Constraints flags; it waits until `/ready` answers. Also `stop()` and `restart()`, which kill it and start it on the same dir and port.
  - `Proxy::start(upstream, Chaos) -> Proxy`
  - `muppet(args) -> Output`
  - `require_ysweet!()`: without the binary, panics if `CI` is set, otherwise prints `skipped: no y-sweet` and returns

**Tests** (from spec section 8.1):
- `three_peers_converge_through_chaos`: chaos seeds 0 to 4, with `delay_ms 20`, `dup 0.05` and `drop 0.02`.
- `late_joiner_loads_in_one_update`.
- `offline_edits_survive_reconnects`: `drop 0.2`.
- `ysweet_restart_keeps_the_document`: start a replay, wait 2 s past the first `LocalAcked`, `restart()`, and the replay completes and the hashes match.
- `init_refuses_existing_content` (Review Focus 4).

**Each test:** the peers' hashes equal one another and `check`'s reference hash for the vector. On failure, print the vector JSON, the chaos seed, every peer's `show --canonical` and the proxy's stderr.

- [ ] **Step 1: Write the tests.**
- [ ] **Step 2: Prove each test can fail.** These are acceptance tests over finished pieces, so the red step is sabotage. `support::sabotage()` is set by `XTXP_E2E_SABOTAGE=1` and gives one peer a different single-round seed's batches. Run with it: each convergence test must FAIL and print the diagnostic dump. Then run normally → PASS, with `YSWEET_BIN=/home/user/ysweet/y-sweet/crates/target/release/y-sweet cargo test -p xtxp-muppet --test e2e --release`.
- [ ] **Step 3: A divergence is a finding.** Debug it with superpowers:systematic-debugging. If the cause is y-sweet's Yrs 0.19.2, record it in the spec's findings and mark that test case `#[ignore = "finding: …"]`, keeping a minimal live repro, as in part 1. Never retry until green.
- [ ] **Step 4: Commit** `e2e: muppets through the chaos proxy against a real y-sweet`.

### Task 10: CI, the try-it script, the README, and the branch

**Files:**
- Modify: `.github/workflows/ci.yml`, `README.md` (create; this also clears part 1's deferred minor)
- Create: `scripts/try-it.sh`

**Content:**
- **CI job `e2e`:**
  - `actions/cache` on `.tools`, keyed `ysweet-4f1909b`;
  - `cargo install --git https://github.com/jamsocket/y-sweet --rev 4f1909b2c3390ced54d32b82a673f4f7ee8ac780 y-sweet --root .tools --locked` if missing;
  - `cargo test -p xtxp-muppet --test e2e --release`, with `CI=true`.
- **`try-it.sh`:** spec section 8.4, steps 1 to 6.
  - `set -euo pipefail`, bash 3.2 compatible (macOS).
  - It checks that port 8080 is free first, with `lsof -iTCP:8080 -sTCP:LISTEN`, which macOS ships, and says what to do if not.
  - It runs `.tools/bin/y-sweet serve .ysweet-data --port 8080 --skip-gc --checkpoint-freq-seconds 1`.
- **README:** what the repo is; links to the spec site and plans; the crates; "Try it" (the script and the manual steps); running the tests.

- [ ] **Step 1:** Run `bash -n scripts/try-it.sh` and `shellcheck scripts/try-it.sh`, if shellcheck is installed in the container (install it with apt if possible). Expected: clean.
- [ ] **Step 2:** Run `try-it.sh` in the container (install `lsof` with apt if it's missing), then from another shell `xtxp-muppet show demo --tree`. Expected: the fixture's tree. Record the output.
- [ ] **Step 3:** Run the full suite (fmt, clippy, workspace tests, release fuzzer and end-to-end tests), push, and watch both CI jobs until green.
- [ ] **Step 4:** Update the spec's findings with anything learnt, then push `website`.
- [ ] **Step 5: Commit** `CI e2e job, try-it script for macOS, README`.
