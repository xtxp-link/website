# M1-y-sweet, part 2: the muppet, the wire and the chaos proxy (design)

**Status:** design approved by David in conversation, 2026-10-18, section by section. This file is the written spec for his review; the implementation plan follows once he approves it.

Part 1 ([design](2026-10-18-m1-y-sweet-part-1-design.md)) built Xmesh, the vectors, the fuzzer and the Yrs 0.19 probe, all without a network. Part 2 puts it on the network against a stock y-sweet.

## 1. What part 2 is for

- **Find out how far a stock y-sweet goes**: setup, storage, reconnects, behaviour on a patchy network, and what it can't express.
- **Give David something to use**: two terminals against a local y-sweet on his Mac, editing one drawing and watching each other's edits arrive.
- **Meet M1's network done-when items** that y-sweet allows:
  - three peers, one a late joiner, converge through the chaos proxy;
  - the late joiner loads the full state in one update.

Still CLI only: the TUI is a terminal program, and anything in a browser is M2-y-sweet.

## 2. Decisions for part 2

Agreed by David during brainstorming on 2026-10-18, as spike-level decisions like part 1's S1 to S10.

| # | Decision |
| --- | --- |
| P1 | **A fresh client ID per connection** (decision 19). On reconnect the muppet copies its whole document into a new Xmesh with a new client ID, so edits made offline keep their old ID and still reach y-sweet. |
| P2 | **y-sweet runs without auth** for part 2. Token auth, with read-only tokens as the closest thing y-sweet has to admission, is a future iteration (section 9). |
| P3 | **The chaos proxy drops connections, not frames.** It delays and duplicates frames and closes connections at random, sometimes losing the frame in flight. It never reorders frames within a connection or drops one while keeping the connection, because TCP doesn't. Peers heal by reconnecting, with a full two-way sync. |
| P4 | **A try-it script for macOS** (`scripts/try-it.sh`). |
| P5 | **An interactive TUI**, plus one-shot commands for tests and scripting. |
| P6 | **Commands apply to the current tree, never refused.** If the tree changed since it was last shown, the command still applies and the muppet prints a one-line note. |
| P7 | **Selection follows the node, not the path.** The TUI holds each node's ID, the Yrs ID of the item that created it (the spec's node ID). It resolves the ID to a path only when an edit is made. |
| P8 | **Names:** `xtxp-wire` for the conversation over one connection (the crate the handover planned), and `xtxp-muppet` for the first local muppet. `xtxp-cli` isn't used. |
| P9 | **Hexagonal muppet.** The core is tested through its own API, without a terminal, a network or a clock. |

## 3. Pieces

```
crates/xmesh          + tree read with node IDs (section 4)
crates/xtxp-wire      the peer side of the Yjs sync protocol, a pure state machine
crates/xtxp-muppet    the muppet: a core library with ports, and a binary with adapters
tools/chaos-proxy     the WebSocket chaos proxy
tools/fuzzer          + single-round vectors
scripts/try-it.sh     run it on a Mac
```

In the spec's terms the running `xtxp-muppet` is a **local muppet** (decision 7): Xmesh is its engine, `xtxp-wire` carries its conversation with a host, and its application layer is the TUI or the one-shot commands. y-sweet stands in for a hosting muppet but isn't one: it runs Yrs 0.19 directly, not Xmesh.

## 4. Xmesh addition: node IDs in the tree

- `Xmesh::tree_with_ids() -> Vec<IdNode>`: the same tree as `tree()`, but each element and text node carries a `NodeId`, the Yrs ID (client and clock) of the item that created it.
- `Xmesh::path_of(id: NodeId) -> Option<Vec<u32>>` gives the node's current path from the root element, or `None` if it's deleted or outside the root.
- Both are pure and read-only, and are tested in Xmesh like the rest of it.

## 5. `xtxp-wire`

A pure state machine for one peer's connection to a host. No I/O, no clock, no threads, no randomness: the caller supplies client IDs. It owns the peer's `Xmesh` and uses `yrs::sync`'s message encoding.

**Interface:** `Peer::new(client_id)`, then `peer.handle(input) -> Vec<Output>`.

- **Inputs:** `Connected`, `Disconnected`, `Frame(bytes)`, `Edit(ops)`, `Reconnect(new_client_id)`.
- **Outputs:**
  - `Send(bytes)`;
  - `Event(…)`, one of `RemoteUpdate { before, after }`, `Synced`, `LocalAcked` or `ProtocolError(reason)`.

`RemoteUpdate` carries the hashes before and after, so a view can tell what changed.

**The protocol, as y-sweet v0.9.1 speaks it:**
- **On connect:** y-sweet sends sync step 1 (its state vector) and an awareness message.
  - The peer replies with its own step 1, and with step 2 carrying what y-sweet lacks.
  - y-sweet answers the peer's step 1 with step 2 carrying what the peer lacks.
  - The peer is `Synced` once that step 2 has arrived and the echo below has come back.
- **Live:** each local edit goes out as a sync `Update`. Incoming updates are applied through `Xmesh::apply`, so its stuck-update retry still covers them.
- **Acknowledgement:** y-sweet echoes custom message 102 ("sync status") in order. After sending its step 2 or an update, the peer sends a 102 carrying a counter. When the echo arrives, y-sweet has processed everything before it, and the peer reports `LocalAcked`.
- **Awareness** messages are decoded and ignored.

**Reconnect (P1).** `Reconnect(id)` copies the document into a new `Xmesh` with client ID `id`, using the full state as one update, then runs the handshake again on the next `Connected`. Edits made while disconnected go up in the next step 2.

**Errors.** A frame that can't be decoded, or an update Xmesh refuses, gives `ProtocolError`, and the adapter reconnects. Nothing panics.

**Testing.** Unit tests drive peers against an in-process fake host: about 40 lines that apply updates, relay them, answer step 1 and echo 102s.
- two peers converge;
- a third, joining late, gets the full state in one step 2;
- offline edits survive a `Reconnect`;
- duplicated frames change nothing;
- a garbage frame gives `ProtocolError`.

## 6. `xtxp-muppet`

### 6.1 Structure (P9)

**Core** (`src/core/`): the `Muppet` application service. It owns an `xtxp-wire` `Peer` and holds the application logic:
- the current tree with node IDs, and the snapshot hash it was last shown at;
- turning intents into ops on the current tree (P6, P7): for example, "set attribute `fill` on node *X* to `red`" resolves *X* to its current path and edits;
- the "tree changed since shown" note;
- the one-shot flows: edit and wait for `LocalAcked`, or sync and report.

**Ports** (`src/ports.rs`), as traits:
- **Driving:** the `Command` enum and `Muppet::handle(command)`, which the adapters call.
- **Driven:**
  - `Transport`: connect, send a frame, receive frames, closed;
  - `Clock`: the current time, and timers for backoff and quiet periods;
  - `IdSource`: fresh client IDs, random 53-bit, never 0;
  - `View`: receives the tree, events and notes to show.

**Adapters** (`src/adapters/`), used only by the binary:
- the ratatui TUI (`tui/`);
- the one-shot commands (`cli.rs`);
- the tokio WebSocket transport (`ws.rs`, on `tokio-tungstenite`);
- the system clock and random IDs.

The core depends on no adapter, no tokio, no terminal library and no network library.

### 6.2 Talking to y-sweet

- With no auth (P2): `POST /doc/new` with `{"docId": NAME}` creates a document, and the WebSocket is `ws://{server}/d/{NAME}/ws/{NAME}`. `--server` defaults to `localhost:8080`.
- **Reconnects** back off from 100 ms, doubling to a 5 s cap, with up to 20% jitter. Each reconnect gets a fresh client ID (P1).

### 6.3 Commands

| Command | Does |
| --- | --- |
| `init <file.svg> [--doc NAME]` | Creates the document and pushes `Xmesh::seed(file)`. Refuses if the document already has content. NAME defaults to the file's stem. |
| `open <doc> [--read-only]` | The TUI (6.4). |
| `edit <doc> <op>… ` | Connects with a fresh client ID, syncs, applies the ops as one batch, waits for `LocalAcked`, prints the new hashes and exits. Ops use the words in 6.5. |
| `show <doc> [--canonical \| --tree \| --hashes]` | Connects, syncs, prints and exits. `--hashes` prints JSON: the document hash, the snapshot hash, and how many updates arrived before `Synced`. |
| `replay <vector.json> --peer NAME [--seed N]` | For tests. Applies that peer's batches to the vector's document, with seeded random gaps of 0 to 50 ms. It edits whether or not it's connected, waits for `LocalAcked`, then waits for 500 ms with no new update, and prints `--hashes` JSON. It only accepts single-round vectors, because separate processes can't keep rounds in step. |

**Errors.** Network failures mean reconnect, not exit. A bad op prints an error, and in the TUI the prompt comes back. Only `init` against a document with content, a file that can't be read or parsed, or a vector `replay` can't use exits with a non-zero status.

### 6.4 The TUI (`open`)

- **Header:** the document name, the snapshot hash, the document hash, and whether it's connected (`● live`, `○ reconnecting`).
- **Tree pane:** the document as an indented tree.
  - ↑/↓ move the selection, ←/→ fold and unfold.
  - Each line shows the element's prefixed name and its `id` attribute if it has one, or the text, shortened.
- **Detail pane:** the selected node's attributes, or its full text.
- **Keys:**

| Key | On | Does |
| --- | --- | --- |
| Enter | element | Opens its attribute list; Enter on an attribute opens an input line with its value; Enter applies, Esc cancels |
| Enter | text | Opens the text in an input line; Enter applies (sent as a delete plus an insert at UTF-16 offsets) |
| `a` | element | Adds an attribute: name, then value |
| `x` | attribute (in the list) | Removes it |
| `d` | node | Deletes it (not the root element) |
| `i` | element | Inserts a first child from a one-line XML fragment, such as `<circle r="5"/>` |
| `m` | node, then element | First press marks the node; second press, on another element, moves it there as its first child; Esc cancels |
| `q` | — | Quits |

- **Remote changes** redraw at once. Nodes whose content changed are highlighted for a second, and a status line says what arrived: `← update, 2 nodes changed`.
- **The note (P6):** `tree changed since shown (@3f9a… → @81c0…); applied to the current tree`.
- **If the selected node is deleted** by someone else, the selection moves to its nearest live ancestor, with a status line.
- **`--read-only`** shows the same view with editing keys off. It's a viewer, not access control: y-sweet has no auth (P2).

### 6.5 Op words (`edit`)

Paths are written `/` for the root element and `0/2` for the third child of its first child. Attribute names are bare (`fill`), use a fixed prefix (`inkscape:label`), or are expanded.

```
set-attr <path> <name> <value>
remove-attr <path> <name>
insert <parent> <index> <xml>
remove <path>
move <path> <new-parent> <index>
insert-text <path> <offset> <text>
delete-text <path> <offset> <len>
```

### 6.6 Testing the muppet

- **Core:** scenarios through `Muppet::handle`, using an in-memory `Transport` wired to the fake host from section 5, a fake `Clock` and fixed client IDs. Deterministic: no terminal, network or real time. The scenarios:
  - two muppets editing concurrently converge;
  - a selection survives a remote insert above it (P7);
  - deleting the selected node moves the selection up;
  - the note appears when the tree changed since shown (P6);
  - offline edits survive a reconnect with a fresh client ID (P1);
  - `edit` waits for `LocalAcked`.
- **TUI:** key-to-command mapping and rendering only, with ratatui's `TestBackend`, checking that the expected tree, panes and status lines are drawn.
- **One-shot CLI:** argument parsing and the op words.

## 7. Chaos proxy (`tools/chaos-proxy`)

- **Where it sits:** a WebSocket proxy between muppets and y-sweet. It accepts on its own port; for each muppet connection, it opens one to y-sweet at the same path and forwards binary frames both ways. Plain HTTP requests (`/doc/new`) are forwarded unchanged.
- **What it does** (P3), from a seeded RNG:
  - delays each frame by 0 to `--delay-ms` ms, keeping order within the connection;
  - duplicates a frame with probability `--dup`;
  - with probability `--drop` per frame, closes both sides of the connection, forwarding the frame first or losing it, half the time each.
- **Logging:** every duplication and drop goes to stderr with the connection number and frame count, so a failing run can be read and repeated with the same `--seed`.
- **Testing:** a unit test runs the proxy between two in-process WebSocket endpoints with a fixed seed. It checks that order is kept, that duplicates arrive, and that drops close both sides.

## 8. End-to-end tests, CI and the try-it script

### 8.1 End-to-end tests

`crates/xtxp-muppet/tests/`. Each test:
- starts y-sweet on a free port, storing into a temporary folder, with `--skip-gc` (GC off everywhere, as decision 19 needs; without it a late joiner's snapshot wouldn't match the peers') and `--checkpoint-freq-seconds 1` (so the restart test has something on disk);
- puts the chaos proxy in front of it;
- runs `xtxp-muppet` as separate processes.

| Test | Checks |
| --- | --- |
| `three_peers_converge_through_chaos` | `init`, then three `replay` peers run one single-round fuzz vector at the same time, through the proxy, for chaos seeds 0 to 4. Every peer's hashes match one another, and match `xmesh::vector::check`'s in-process result for the same vector. |
| `late_joiner_loads_in_one_update` | After the three finish, `show --hashes` from a fourth muppet reports the same hashes, with exactly one update before `Synced`. |
| `offline_edits_survive_reconnects` | With `--drop` high, replay peers keep editing while disconnected, with fresh client IDs on reconnect, and still converge. |
| `ysweet_restart_keeps_the_document` | y-sweet is stopped mid-run and restarted on the same folder; the peers reconnect, and nothing is lost. |

On divergence, a test prints:
- the vector;
- the chaos seed;
- every peer's canonical XML;
- the proxy's log.

**A divergence is a finding to investigate, not a flake to retry.** y-sweet's Yrs 0.19.2 is a known suspect, because it loses deletes that arrive before their inserts.

**The y-sweet binary:**

```
cargo install --git https://github.com/jamsocket/y-sweet --rev 4f1909b2c3390ced54d32b82a673f4f7ee8ac780 y-sweet --root .tools
```

`YSWEET_BIN` overrides the path. Without the binary, end-to-end tests fail when `CI` is set and are skipped with a message otherwise.

### 8.2 Fuzzer addition

`generate_single_round(seed) -> Vector`: one round, 3 peers, each with 2 to 6 batches. Every batch is generated against that peer's own replica, starting from the seed, so it can be replayed by a separate process. `generate(seed)` is unchanged, so part 1's seeds, including the pinned seed-0 finding, stay as they are.

### 8.3 CI

- A second job, `e2e`, builds y-sweet into `.tools` and caches it by commit, then runs `cargo test -p xtxp-muppet --test '*' --release`.
- The existing job is unchanged, apart from the new crates' unit tests.

### 8.4 `scripts/try-it.sh` (P4, macOS)

1. Checks that `cargo` is installed, and if not, says how to install Rust.
2. Builds y-sweet into `.tools` if it isn't there yet (once, a few minutes), and `xtxp-muppet` in release.
3. Starts y-sweet on `localhost:8080`, with data in `.ysweet-data`, with `--skip-gc --checkpoint-freq-seconds 1`.
4. Runs `init` with `crates/xmesh/tests/fixtures/inkscape-blank.svg` as the document `demo`, unless `demo` already exists.
5. Prints the command to paste into two more terminals: `target/release/xtxp-muppet open demo`.
6. Keeps y-sweet in the foreground. Ctrl-C stops it, and the data stays for next time.

It uses only bash and tools macOS ships with. The README gets a "Try it" section with the same steps by hand.

## 9. Not in part 2, and recorded for later

- **y-sweet's token auth:** full and read-only client tokens. It's the next iteration, and the closest y-sweet comes to admission (done-when item 4).
- **Done-when items 4 to 6:** key grants, session refusal and the signed handshake. y-sweet can't express them; they're recorded as gaps.
- **Awareness**, meaning cursors and presence, which the TUI could show later.
- **Anything in a browser**, which is M2-y-sweet.
