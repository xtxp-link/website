# XTXP spec review (pre-implementation)

Scope: every page under `src/content/docs/` and every `diagrams/*.puml` (the rendered copies in `public/diagrams/src/` match the sources byte for byte). Paths below are relative to `/home/claude/xtxp-link/`. Severity: **H** high, **M** medium, **L** low.

Overall: the direction is coherent (Yrs underneath, a node-map tree layer, one host per branch, key identity), and the pages agree with each other more than most drafts do. But several leftovers from earlier designs survive, mostly in the glossary, the decision log and the diagrams. A few core claims are wrong *as a matter of how Yrs works*. The biggest: a state vector does not name a point in history, and a host cannot simply refuse Yrs updates. These need fixing before M1, because the vector suite and the handshake rest on them.

---

## 1. Contradictions and stale text

### 1.1 Stale data model in the glossary — H
- `overview/glossary.md`, **Immortal parent**: "Attributes live in a map and children in an array inside it".
- `spec/math.mdx` says the opposite: "its **children** point to it, rather than living inside it", and the document is "a map of nodes, keyed by a stable node ID, not a nested Yrs XML fragment".
- **Fix:** "An element node that is never replaced, only updated. Its attributes live in a map; its children point to it through their edge maps, so concurrent edits to one element never orphan each other."

### 1.2 Branch identity: "parent + state vector" survives in three places — H
The current rule (`spec/branches.mdx`, decision 16) is "identified by where it lives: its address … There are no generated IDs." Stale text remains in three places:
- `diagrams/07-seq-branch.puml` note: "A branch is identified by its parent plus the state vector at the fork."
- `spec/math.mdx` (Clocks): "A state vector also names a point in history, which is how branches are identified."
- `overview/glossary.md`, **Branch**: "A fork of a document's history at a given state vector, identified by where it lives". This one is mostly fine; it just leads with the SV.
- **Fix:** "A branch is identified by its address; it records its parent's address and the snapshot at the fork." See also 2.1: it must be a snapshot, not just a state vector.

### 1.3 Decision 1 contradicts decision 16 and the hosting model — H
- `discussion/decisions.md` §1: "**Hosting MUPPETs** relay: they admit, order and pass on operations, and they may be blind to content. **Peers** run the CRDT engine."
- Decision 16 says "There is one kind of node, the MUPPET". `spec/branches.mdx` says "A host holds the branch's Xmesh document like any other MUPPET", and it compacts and hands out full state. A host therefore does run the engine. It also does not "order" anything: CRDT order needs no host, and only *admission* order matters.
- **Fix:** delete decision 1, or rewrite it as "Hosts are MUPPETs that also admit, route and store. They run the same engine. An end-to-end-encrypted branch is the one case where a host only stores and forwards (see The Wire)." Mark the old text as superseded rather than silently editing it.

### 1.4 "Held by the MUPPETs that host it" (plural) versus one host per branch — M
- `discussion/decisions.md` §7: "**A branch is held by the MUPPETs that host it**".
- `spec/branches.mdx` front-matter description: "held by the MUPPETs that host them".
- Both conflict with "Each branch lives on exactly one host" (`branches.mdx`, decision 16, glossary).
- **Fix:** "A branch is hosted by exactly one MUPPET; any number of MUPPETs may hold replicas."

### 1.5 Identity as `user@domain` in diagram 04 — H
- `diagrams/04-seq-nojs-edit.puml`: "edit intent for user@domain".
- `spec/identity.mdx`: "no email-like addresses".
- **Fix:** "edit intent for key P (session)".

### 1.6 Wire format: binary Yrs updates, or an XML patch stream? — H
- `spec/wire.mdx`: "operations travel in Yrs's binary update format".
- `spec/addressing.mdx` content negotiation: "`Accept: application/xtxp+xml` | The raw CRDT patch stream". Media types: "probably as `application/vnd.xtxp+xml`".
- `diagrams/11-seq-negotiation.puml`: "Accept: application/xtxp+xml … raw XTXP patch stream".
- `spec/math.mdx` / addressing: patches "reuse `application/xml-patch+xml`".
- The `+xml` suffix is wrong for a binary lib0/Yrs stream. XML Patch is an *input* language (UI to engine), not the wire.
- **Fix:** state one rule: "On the wire, XTXP carries Yrs updates (encoding v1 or v2, pick one) inside XTXP frames. XML Patch is an optional import/export format for edits." Rename the stream type to something like `application/vnd.xtxp` (no `+xml`), or drop HTTP streaming entirely (see 1.7).

### 1.7 An HTTP patch stream is not a listed binding — M
- `spec/addressing.mdx` and diagram 11 show the gateway opening "a raw patch stream" for `Accept: application/xtxp+xml`.
- `spec/wire.mdx` Bindings lists HTTP only as "forms and redirects … Browsers with no JavaScript".
- **Fix:** either add an HTTP upgrade to the WebSocket binding (the gateway answers with a WebSocket URL or upgrades the connection), or remove the stream row from negotiation.

### 1.8 "Directory" and "currently hosting" versus address-as-location — M
- `spec/addressing.mdx`: "A universal HTTP bridge and **directory**"; "**Node resolution**: the gateway routes a session to the federated node **currently** hosting a document".
- `diagrams/11-seq-negotiation.puml`: participant "Directory", "who hosts {host}/{path}?".
- If a branch's address *is* its host (`{host}/{path}@{name}`) and a branch never moves, there is nothing to look up for native documents. "Currently hosting" implies migration, which the model forbids. "Directory" is not defined anywhere, including the glossary.
- **Fix:** "The gateway connects to `{host}` (resolution: open question *native or website?*). Website branches are hosted by the gateway itself." Drop "currently" and "federated", or define migration explicitly.

### 1.9 Website branch addresses break "identified by where it lives" — H
- `spec/addressing.mdx` example: `xtxp.link/en.wikipedia.org/wiki/Browser@notes  an edited branch of it`. Here `{host}` is Wikipedia, but the branch lives on the gateway.
- `discussion/open-questions.md` admits it: "an ordinary website isn't a MUPPET, so its branches need a host … other hosts address theirs through their own name". But no address form exists for "a branch of en.wikipedia.org/wiki/Browser hosted on myhost".
- Also, `spec/identity.mdx` says "`@origin` is readable by `*` and writable by no one". Yet `spec/web-overlay.mdx` says "the differences between successive fetches become that peer's operations. Its branch is `@origin`." Someone has to write `@origin`.
- **Fix:** define the website form explicitly. For example, `{host}` in a website address means "the origin's document, hosted by the gateway". Define a nested form for other hosts (`{myhost}/{origin-host}/{path}@{name}`), or forbid it for now. Change `@origin` to "writable only by the gateway's upstream-peer key".

### 1.10 LAN examples that the public gateway cannot reach — M
- `spec/addressing.mdx`: `xtxp.link/my-laptop.lan/drawing@sketch   a fork, living on a laptop`. `spec/branches.mdx` uses `my-laptop.lan/drawing@sketch`.
- `spec/wire.mdx`: "Every binding runs over TLS." Publicly trusted TLS certificates are not issued for `.lan` names, and xtxp.link cannot route to a private network.
- **Fix:** use `xtxp://my-laptop.lan/…` for LAN examples, and say how LAN hosts authenticate (host keys, TOFU, key-pinned TLS or similar). Or mark the example as reachable only from the same network.

### 1.11 Trust direction and "paused" are described inconsistently — H
- Glossary **Trust**: "A branch trusting another branch, so the other's changes merge **into it**."
- `diagrams/16-branch-trust.puml` labels `@sketch` "paused: automatic merge **into main** off". Under the trust rule, whether sketch merges into main depends on *main* trusting sketch, which is main's owner's setting, not a property of sketch. The diagram then says "on release: main trusts sketch (an ordinary merge)". So release is a *standing trust edge* there.
- `spec/views.mdx` / glossary **Paused queue**: "releasing it is an ordinary [merge]". `diagrams/07-seq-branch.puml` and `08-state-branch.puml` model merge as a *one-shot replay* ("Proposed → Merged : accept → replay into parent"). `08` has Paused ↔ Active with no trust concept, and "Merged → [*]" is terminal, which a two-way trusted branch never is.
- **Fix:** make "paused" a property of a trust edge: "edge parent←branch disabled". Distinguish a **one-shot merge** (apply the branch's updates once) from **trust** (continuous merge). Redraw `08` with an "auto-merging (trusted)" state, or say the lifecycle applies only to untrusted proposals. Fix the `16` label to "main does not yet trust sketch".

### 1.12 Is undo a branch or not? — M
- `overview/what-is-xtxp.mdx`: "**Branches as history.** Undo, proposed edits and previews are all the same thing: a branch".
- `overview/glossary.md` **Branch**: "Undo, proposed edits, previews and paused queues are all branches."
- `diagrams/07-seq-branch.puml` title: "Branch as undo history"; "Undo, proposals and previews are the same mechanism."
- But `spec/branches.mdx` §Undo in practice says Ctrl+Z "reverses *your own* recent actions with **inverse operations**". That is not a branch. Only "history undo" is a branch.
- **Fix:** "History undo and proposals are branches; personal undo (Ctrl+Z) is inverse operations on the current branch."

### 1.13 Opening an existing name versus rejecting a taken name — M
- `spec/branches.mdx` says three things. "Asking for a name that already exists opens that branch". "Creating a new fork on a name that's taken is rejected". "Two people who pick the same name for the same thing end up working in the same branch."
- The third follows from the first only if the second person *opens* rather than *forks*. Under the second rule, a fork request for a taken name fails. The Wire has no messages for either operation (see 3.1).
- **Fix:** define two operations, `open(name)` and `fork(parent, name)`. Say `fork` on a taken name fails with "exists; open it instead?". Keep the third sentence as a UX note.

### 1.14 "Run headless … on an Inkscape instance" — L
- `index.mdx`: "Run headless, a MUPPET hosts a branch: … on a server or on an Inkscape instance on a local network." An Inkscape instance is not headless.
- Glossary **Host** has "usually headless", which is fine. `diagrams/16` has "Inkscape A hosting".
- **Fix:** "Any MUPPET can host a branch; on a server it runs headless."

### 1.15 Server MUPPET placement — L
- Decision 15: "with the server-side MUPPET **in the same binary**".
- `diagrams/03-deployment.puml` puts the "Server MUPPET" on a separate "App server" node. Its hosting node is titled "one binary, or one Durable Object per branch". Durable Objects are still an open question (`open-questions.md` §Engine: "a single self-hosted Rust binary, or Cloudflare Workers"), while decision 15 reads as decided.
- **Fix:** put the server MUPPET in the hosting binary in `03`, or say "same binary, or split". Reconcile decision 15 with the open hosting question ("decided for M1–M2; Durable Objects remain an option").

### 1.16 Two versus three CLI peers in M1 — L
- `build/milestones.mdx` and `build/verification.mdx`: "Two CLI peers".
- `diagrams/13-verification.puml`: three peers, including "CLI peer 3 (late joiner)".
- **Fix:** three peers. A late joiner is the cheapest way to test full-state load, so say so in the text.

### 1.17 Stale ref name "live" — L
- `spec/addressing.mdx`, alt text of diagram 11: "The ref after the last @ picks **live**, a branch or a state vector."
- The diagram itself says `@origin`/`@main`. `open-questions.md` still lists "`@main` or `@latest`", while the addressing table and decision 9 use `@main` as settled.
- **Fix:** update the alt text. Either close the `@main`/`@latest` question or mark `@main` as provisional in the addressing table.

### 1.18 Generated links without a ref — L
- `diagrams/04-seq-nojs-edit.puml`: `POST /host/doc`, `303 See Other → GET /host/doc`.
- `spec/addressing.mdx` rule 2: "Links the gateway generates always carry a ref."
- **Fix:** `/host/doc@main`.

### 1.19 The glossary's MUPPET entry omits hosting — L
- `overview/glossary.md` **MUPPET**: "The client-side embedding of Xmesh, and the application layer". It leaves out hosting, which decision 16 and the naming section ("executor, the application layer and hosting") include.
- `diagrams/02-components.puml` package: "MUPPET — the executor (client-side Xmesh)" contains the *server* MUPPET.
- **Fix:** add "… and, run headless, a branch host."

### 1.20 Views "never touch document state", but a paused queue is document state — L
- `overview/architecture.mdx`: MUPPET owns "paused queues, onion skin and branch previews, none of which change document state". `spec/views.mdx`: "ephemeral changes to the displayed tree and never touch document state".
- A paused queue is a branch full of real operations (`branches.mdx`).
- **Fix:** "Views never change the state of the branch being viewed."

### 1.21 E2E encryption: a blind host, or a host that compacts and serves state? — M
- Decision 1: hosts "may be blind to content". Decision 2: "end-to-end encrypted rooms stay possible". `spec/wire.mdx` §Encryption: "The host can still **admit** operations, because client bindings and grants are metadata it can check."
- Client IDs and clocks are *inside* the Yrs update. A host that sees only ciphertext cannot compute a state vector, so it cannot answer `sync-1`. That contradicts "Recovering from a dropped connection is part of XTXP itself" and "New clients load its full state as one compact update" (`architecture.mdx`). See also 2.10.
- **Fix:** mark E2E as out of scope until after M4, or specify a cleartext envelope (client, clock range) beside the ciphertext and an append-only, log-based sync for E2E branches.

### 1.22 "Decided" labels over open foundations — M
- `build/verification.mdx` is **decided**, and its pass condition is "the same SHA-256 of the canonical XML". But canonicalisation is open (`math.mdx` "Canonicalisation … open", `open-questions.md` "the exact XML canonicalisation"). The decided invariant is undefined.
- `overview/architecture.mdx` marks Xmesh **decided** while `spec/math.mdx` is **draft** and "adopt `yrs_tree` or write our own" is open.
- `build/milestones.mdx` is **decided**, but gateway placement (Q9) is open.
- **Fix:** label these "decided in shape, draft in detail", as `wire.mdx` does. Close canonicalisation for M1 (see 3.1).

### 1.23 Decision log gaps and the "rooms" vocabulary — L
- `discussion/decisions.md` jumps 2→5→6→7→9→11…; 3, 4, 8 and 10 are missing. "Numbers stay stable" is fine, but readers cannot see *what* was superseded. Keep stub entries ("3. Superseded by 13: …").
- "rooms" (decision 2, `wire.mdx` "OMEMO … for rooms") is the old vocabulary; the rest of the spec says "branches". In XMPP context, "MUC rooms bridged to a branch" is clearer.

### 1.24 Small wording problems — L
- `build/milestones.mdx`: "whether hosting extends y-sweet, borrow from it" should be "borrows".
- `diagrams/14-milestones.puml`: M3 "browser MUPPET (Wasm **polyfill**)". "Polyfill" is the wrong word; use "full Wasm peer".
- `diagrams/02` alias `trk` and `03` aliases `t0..t2` look like leftovers from a "tracker" name. They are harmless, but rename them when next editing.
- `discussion/diagrams.mdx` lists 16 before 15.

---

## 2. Technical soundness

### 2.1 A state vector does not name a point in history — H
`math.mdx` ("A state vector also names a point in history"), `branches.mdx` ("A branch is a fork … at a point given by a state vector"), `09-class-model.puml` (`fork_at : StateVector`) and `@{state vector}` addressing all assume a state vector pins a state. In Yjs/Yrs, deletions do not consume clock values: they live in a separate delete set. That is why a Yjs snapshot is *(state vector, delete set)*.
- **Failure:** fork at SV, where content X was deleted *after* SV. Rebuilding "the state at SV" from the current store applies the later deletion, so X is missing from the fork. Two hosts rebuilding the same `@{sv}` URL from different delete sets get different documents, and the "exact point in history" claim fails.
- The same flaw hits **ETags** (see 3.2). An ETag derived from the state vector will not change after a pure delete (for example, deleting a shape), so no-JS viewers get `304 Not Modified` and keep seeing the deleted shape.
- **Fix:** branches record a **snapshot** (SV plus delete set, or a hash of it). A URL ref names a snapshot (or a hash of one), and ETags derive from the snapshot or from a host-side sequence number. A fork must be seeded with the parent's *items with their original IDs* (encode state from snapshot, GC off). Re-creating the content would give the items new IDs and make merge-back impossible. I believe Yrs has an encode-from-snapshot API that needs GC off, but confirm it during the y-sweet/Yrs review.

### 2.2 A host cannot simply refuse Yrs updates — H
The model has a host admit or refuse operations "in arrival order" and keep refused ones as previews or on a fork. Yrs integrates by causal dependency and requires each client's clocks to be contiguous:
- **Same-client gap:** host rejects Q's `(9, 10..20)`; later (re-granted, or via a merge) `(9, 21)` arrives. Yrs cannot integrate it and leaves it pending forever. A refused client ID is dead. The spec must say so and require a fresh client ID (and binding) after any rejection.
- **Cross-client dependency:** P (who holds write) sees Q's not-yet-admitted insert via any non-host path (a trusted merge, direct peer-to-peer, or Q's preview) and inserts next to it. P's op now has an origin pointer to Q's item. The host admits P but refuses Q, so P's op sits pending, and P's later ops queue behind it. P's edits silently stop appearing for everyone.
- **Peers cannot "un-integrate":** `identity.mdx` says "Operations a peer has seen but the host hasn't admitted are previews". Once an update is applied to a Yrs doc it is in that doc's state vector and content. Previews therefore need a *separate* doc per pending source (a local branch), never the replica of the hosted branch.
- **Fix:** specify that a peer's replica only ever contains host-admitted updates. Previews live in separate docs. A host refuses whole client IDs, never individual updates mid-stream. Merged-in ops that depend on non-admitted items are refused as a unit, with a defined error. Add vectors for each case.

### 2.3 Client ID reuse across branches corrupts merges — H
`ClientBinding` is scoped to `document : DocId` ("P owns client 7 on this document"), and forks share item IDs with their parent. If a MUPPET edits `@main` and `@sketch` with the same client ID, it produces two different items both named `(7, 50)`. When sketch merges back, Yrs treats one as a duplicate and drops it. The replicas diverge silently with no error.
- **Fix (normative):** a client ID MUST be fresh per (branch, session). Bindings are scoped to a branch address, not a "document". Hosts MUST reject a binding for a client ID already present anywhere in the branch's history, including history inherited from the parent and from trusted branches. "DocId" is not defined anywhere and should go (see 4.2).

### 2.4 Admission of merged ops is undefined, and trust is transitive — H
- Glossary **Admission**: "the client ID is bound to a key that holds write access". With trust, ops from authors with no write grant on A enter A through B. Does A's host check each author's grant, or only the trust edge? If it checks grants, two-way trust and merges of collaborators' proposals mostly fail. If it checks only the trust edge, then **anyone with write on any branch A trusts (directly or transitively) can write to A**.
- Trust is effectively transitive. If A trusts B and B trusts C, C's ops become part of B's state and flow on to A. `identity.mdx` handles revocation only at one hop ("the owner withdraws trust from the branch they come from").
- **Failure:** Q is revoked on `@review`. Q keeps editing their own fork F. The owner of `@studio`, which `@review` trusts, trusts F. Q's new edits reach `@review` automatically, and nothing anywhere records that this happened.
- **Fix:** say that trust is an admission bypass and is transitive. Define whether hosts carry a provenance path per update (which branch each merged update came from). Define what revoking a key means across trust edges (for example, hosts refuse updates from a revoked key on any trusted inbound path, with the dependency caveats from 2.2).

### 2.5 Cycle-resolution order is not pinned, which is a convergence risk — H
`math.mdx` / `10-activity-move.puml`: "Any nodes caught in a cycle are reattached one by one … pick the next node and an edge to an already-rooted parent". The order of "pick the next node" changes the result: reattaching A first can root B, while reattaching B first can root A. Unless the order is fully specified, two implementations, or one implementation using hash-map iteration order, produce different trees and therefore different hashes.
Other cases are not covered:
- a node in a cycle with **no** edge to any rooted parent
- a node whose parent is **deleted**
- moving into a descendant (local precondition, rejected at write time or not)
- the tie-break key for equal counters ("ID breaks ties": the parent's NodeId? the writer's client ID?)

**Fix:** write the read algorithm as numbered, deterministic pseudocode: iteration order, candidate choice, the fallback (attach to root, or hide), and the treatment of deleted parents. Check it against Wallace's write-up and `yrs_tree`. I have not verified that `yrs_tree`'s exact rule matches the text here.

### 2.6 Position and parent can win independently — M/H
`position` is a separate LWW field from `edges`. Suppose Alice moves X into G1 at index k1 and Bob concurrently moves X into G2 at k2. The two moves have equal counters, so the edge tie-break picks G1. The `position` map entry resolves by Yrs's own LWW rule (by client ID), which may pick Bob's k2. X ends up in G1 at a position key from G2's key space. That is valid but arbitrary, and it is not the intent of either user.
- **Fix:** store the position *on the edge* (`edges: parent → {counter, position}`), so parent and position win together. Re-ordering within the same parent then writes a new edge counter (or a separate per-parent position entry).

### 2.7 Fractional-index collisions and interleaving — M
Two peers inserting between the same pair of siblings can generate *equal* keys. Without a tie-breaker (append the client ID or a random suffix), sibling order is undefined, which breaks hash convergence. Concurrent runs of inserts can also interleave. That is a known anomaly for position-key schemes like Logoot/LSEQ: Kleppmann et al. discuss interleaving anomalies, and fractional indexing behaves similarly. **Fix:** specify key generation, including the tie-breaker, and the comparison order. Add a vector for "N peers each insert 5 siblings at the same spot".

### 2.8 Node deletion, text and the rest of XML are missing from the data model — H
- **Deletion** is not specified. Is a node removed from the `nodes` map, or marked with a tombstone flag? What happens to concurrent edits and moves *into* a deleted node (removing from the map orphans the children's edges)? XML Patch `remove` needs a defined semantics.
- **Mixed content:** each element has one optional `text`. SVG `<text>` with interleaved `<tspan>`s, and all HTML (web overlays), need text nodes as siblings of elements. Model text, comment, CDATA and processing-instruction nodes as node kinds.
- **Namespaces:** Inkscape SVG relies on `inkscape:`, `sodipodi:` and `xlink:` attributes and elements. `tag : string` / `attrs : Map<string,string>` does not say whether keys are QNames, `{uri}local` or prefixed names. Canonical XML depends on the answer.
- **Root and genesis:** `root : NodeId`. If two peers each create a root, they diverge. Genesis must be a single shared update, which also bears on the fuzzer's "initial SVG".
- **Node ID generation:** not specified. It must be collision-free with no coordination (for example, the Yrs ID of the creating op, or a random 128-bit value).
- **The `@` prefix:** the table writes `@fill`. Is the `@` stored in the key?

### 2.9 Intent preservation fails for SVG's `style`, `d` and `transform` — M
Requirement 2 promises that concurrent changes to an element survive. Inkscape stores most styling in one `style="fill:…;stroke:…"` attribute, so whole-value LWW loses a concurrent fill change when someone else changes the stroke. The same applies to `d` (path data) and `transform`. **Fix:** either split `style` into a property map in the schema (and serialise it canonically), or state the limitation and test it. The same applies to the `class` attribute.

### 2.10 Handshake details that matter for security — M/H
- **Challenge relay:** "The host sends a random challenge and the peer signs it." If only the nonce is signed, a malicious host A can forward host B's challenge to a victim who connects to A, then use the victim's signature to log in to B as the victim. The signed statement must include a domain-separation tag, the host's name (or host key) and, ideally, a TLS channel binding.
- **Binding replay / front-running:** a binding is a stored, signed statement. Diagram 15 limits it to "ops from client 7 **on this connection**". Bindings must also travel with merged ops (they are "Stored: Yes"), and there they are not tied to any connection. Define what stops someone replaying P's binding on another connection, and who wins if two keys bind the same client ID (first binding wins, the second is rejected).
- **Key algorithm and encodings:** not stated. Ed25519 is the obvious default.
- **Host identity:** hosts have no keys, so host-to-host trust sync (and LAN hosts without public TLS, see 1.10) has no authentication story.
- **Awareness spoofing:** awareness messages carry client IDs. Scope them to the authenticated connection.

### 2.11 Merge semantics and redline — M
- "Merging is mechanical … Nobody has to resolve conflicts by hand" is true for *convergence*, but LWW still silently discards one side's attribute change, and edits to nodes deleted in the parent vanish. Call this out instead of implying there are no conflicts.
- `branches.mdx`: "the redline is exactly the set of operations being applied". Some of those operations lose LWW or are already in the parent, so an op list misreports what changes. `views.mdx` correctly asks for "Cheap diffs between two states". Make the redline a **state diff** (parent snapshot versus merged result), attributed to authors.
- **History undo cannot be merged back:** a branch from an earlier SV has no operations that revert later changes. Merging it into main is a no-op for the content it omits, and Yjs deletions are permanent, so "undone work … can be reached again through a branch" works for *viewing* only. Restoring a past state in main requires *generating* inverse ops (a diff from the snapshot to now). Say so, because users will expect "restore this version".
- Diagram 07, "request ops since SV": use main's current state vector, or the overlap is wasted (harmless, since updates are idempotent).

### 2.12 Revocation's "fork owned by the revoked user" — M
Who creates and hosts it? On the protected branch's host, it gives a revoked (possibly hostile) key unbounded storage on that host. How is it named? Can the owner delete it? How does Q learn about it? **Fix:** the host refuses the ops and tells the client. The *client* keeps its unadmitted ops locally and may fork elsewhere. That gives the same "nothing lost" outcome with no host liability.

### 2.13 Sign-in and key custody — M
- Storing the private key in Google or Apple storage makes the provider able to read it, and so to impersonate the user, unless it is encrypted. That undercuts "no central account owns anyone" (`what-is-xtxp.mdx`). The PRF option is listed as open; make the threat explicit.
- "Mozilla" as a sign-in provider: I am not sure what is intended (Mozilla Persona was shut down years ago; Mozilla accounts exist, but I don't know of a user-storage API for third parties). Check before naming it.
- **No-JS:** "the server-side MUPPET … holds it for the session" means the gateway operator holds the *root* private keys of every no-JS user. Prefer a server-generated **device key**, granted or signed by the user, which is what the open question about several devices points to anyway.

### 2.14 Smaller points — L/M
- **Update encoding:** "Yrs's binary update format". Yrs has v1 and v2 encodings. Pick one normatively, because the wire contract is effectively "Yrs/Yjs compatible", and a C++ rewrite would have to match it bit for bit, including YATA tie-breaks.
- **Pending-update DoS:** a client can send updates with large clock gaps that never resolve. The host needs a cap on pending structs and a defined error.
- **"Vector 0"** (`web-overlay.mdx`, `12`): the genesis content has nonzero clocks from the upstream peer. "Genesis snapshot" is more accurate.
- **The "@ in the path" rule** (`addressing.mdx` rule 3: "with an `@` whose text doesn't resolve to a ref, treat it as part of the path"): someone can create a branch named `campey` on `medium.com/`, and then bare `medium.com/@campey` links resolve to their branch. Only gateway-generated links should be parsed as refs. Bare URLs should always be treated as path plus default ref. Also say the `@` rule applies to the path only, not the query string or fragment (`?email=a@b.com`).
- **"Hostnames always contain a dot":** not true for `localhost`, single-label LAN names, IPv6 literals or `host:port`. Define the forms that are allowed.

### 2.15 Web overlay and gateway security beyond what is listed — H (before any public gateway; M for M2 alone)
`web-overlay.mdx`'s list covers credentials and forms. Two risks are missing:
- **Same-origin execution:** rewritten third-party pages, and user-supplied SVG (SVG can contain `<script>`, event handlers and `foreignObject`), served from `xtxp.link` run in the gateway's own origin. That means stored XSS against every logged-in user: session theft and forged edit POSTs. **Fix:** strip all scripts and handlers, serve with a strict CSP, and serve user content from a separate sandbox origin (for example, per-host subdomains on another registrable domain). This applies to M2's SVG rendering too, not just overlays.
- **CSRF** on the no-JS edit forms: they need tokens or SameSite cookies.
- On-demand fetching of any URL makes the gateway an open fetcher (SSRF to internal addresses, abuse traffic). Block private address ranges and rate-limit.

---

## 3. MVP readiness

### 3.1 M1 (headless convergence): what must be decided first
Most items are small, but M1 cannot start without them.

1. **The tree schema, normatively:** node kinds (element, text at least), node ID format, deletion semantics, namespace representation, genesis/root as one shared update, position-on-edge (2.6), fractional key generation with a tie-breaker (2.7). — H
2. **The move read algorithm as deterministic pseudocode** (2.5), and the `yrs_tree` adopt-or-write decision. It is cheap to decide: spike `yrs_tree` against the pseudocode vectors for a week. — H
3. **Canonical XML for hashing:** no need for full W3C C14N. Define "Xmesh canonical form v0": sorted attributes, fixed namespace prefixes, UTF-8, no insignificant whitespace, defined escaping. — H
4. **The JSON vector schema:** initial state, per-client op streams *in Xmesh API terms* (insert, move, set-attr, delete, text-edit on node IDs), delivery schedules, expected invariants. The fuzzer's "adding comments" needs a comment model or should be dropped (see 4.4). — H
5. **Framing:** the message envelope, and how XTXP's `hello/challenge/prove/bind/grant` sit next to y-protocols sync and awareness. A message-type byte with reserved ranges is enough. Branch selection on connect (for example, the WebSocket URL path is the branch address). — H
6. **The handshake:** Ed25519, the signed challenge structure (domain tag, host name, branch, nonce), the binding structure (scoped to a branch), the first-binding-wins rule, and "fresh client ID per branch per session" (2.3, 2.10). — H
7. **Admission semantics for M1:** grants from a static config file signed by the owner key. Refusal works per whole client ID, with an error message (2.2). Keep revocation out of M1, or limit it to "refuse plus disconnect". — M
8. **Snapshot rather than state vector** wherever a state is named (2.1). M1 doesn't fork, but the storage format should keep GC off and store the delete set from day one. — M
9. **Storage:** append-then-compact on the local filesystem behind a trait. The y-sweet review should produce a *written* go/no-go with those criteria (milestones.mdx lists them well). — M
10. **The chaos harness:** a proxy between peers and host that drops connections and delays and duplicates frames. WebSocket preserves order, so reordering happens at the harness level. Include a late joiner (1.16) and peer restarts with persisted state. — M

**Defer from M1:** forks, merges, trust, revocation across branches, E2E, awareness, gateway, XMPP, SSO key fetch (use key files), multiple devices, `@{sv}` URLs.

**Smallest sensible M1:** one host binary, one branch `@main`, three CLI peers, key files, static signed grants, sync and update only, file storage, the vector suite in-process *and* over the chaos proxy, and hash equality on canonical XML.

### 3.2 M2 (Inkscape plus no-JS): what is missing
1. **Inkscape adapter contract** — H
   - the NodeId ↔ `Inkscape::XML::Node` mapping (Inkboard's "tracker")
   - echo suppression: remote changes applied must not be re-captured by the commit hook
   - what happens to Inkscape's own undo stack when remote XML events interleave. Inkscape replays inverse XML events, which can clobber remote edits. The simplest sound choice is to route Ctrl+Z to a Yrs-scoped UndoManager and bypass Inkscape's stack for shared documents, and the spec currently implies both approaches.
   - auto-generated `id` collisions (two peers both create `path1234`), which break `url(#…)` references. Inkboard hit this.
   - `defs`, `sodipodi:namedview`, comments and other unsupported node kinds
2. **The C ABI surface** of Xmesh (cbindgen-style; ownership of buffers; threading, since the core is pure but Inkscape calls it from the GTK main loop and the network runs on another thread). — M
3. **The no-JS editing model:** which forms exist (select element, edit attribute, recolour, move by offset, delete, add basic shape, comment?), how a POST names its target (node ID in a hidden field), and how the "edit intent" maps to Xmesh calls. Today it is just "form POST → edit intent". — H
4. **The no-JS session and identity:** for M2, use a server-generated device key per session, granted by the owner (or a demo `*` write grant), plus CSRF tokens. Defer SSO key fetch. — M
5. **ETag** derived from a snapshot hash or host sequence, not the state vector (2.1). — H
6. **Rendering safety:** sanitise SVG, apply a CSP, use a separate origin for user content (2.15). — H
7. **Gateway scope:** native documents only (`{host}/{path}@main`). No website overlays in M2, even if the gateway "folds in" (Q9 option 2 is sensible if limited this way). — M
8. **Native hand-off:** `xtxp://` handler registration on desktop is out of scope; "open address" inside Inkscape is enough. — L

**Defer from M2:** web overlays, forks/branches in the UI (onion skin and redline can come right after M2), trust, revocation UX, Wasm, XMPP.

---

## 4. Other improvements

1. **Normative language and a "Protocol" page — M.** The spec mixes rationale and rules. Add MUST/SHOULD statements (RFC 2119), and give each spec page a short "Normative" block that the vectors trace to. Gherkin → fuzzer → vectors is unclear: feature files describe behaviours, while the fuzzer is random. Say which vectors are hand-written from features and which are fuzzed.
2. **Define "document" — M.** Bindings refer to "this document", the class diagram has `DocId`, and pages say "a document's history", but identity is per branch address. Either define a document (for example, the family of branches sharing a genesis snapshot hash) or remove the term from normative text. Add glossary entries for **Document**, **Client ID**, **Node ID**, **Snapshot**, **Directory** (or remove it) and **Gateway**.
3. **A threat model page — M.** Gather the security points (host forgery, trust transitivity, revocation limits, key custody, gateway XSS/SSRF, phishing) in one place with the explicit non-goals. The Keyhive reference is the right companion.
4. **Comments and spatial chat have no data model — M.** They are called first-class views (`what-is-xtxp.mdx`), the fuzzer generates "adding comments", and the XMPP bridge mirrors them. Decide whether they are SVG elements in a private namespace, a separate Yrs map in the same doc, or another doc.
5. **Missing prior art (verify before citing) — L/M:**
   - Figma's multiplayer write-up: parent pointers plus fractional indexing for a scene tree; Evan Wallace was involved. Highly relevant to 2.6/2.7.
   - Ink & Switch's work on branching and version control for CRDT documents (I believe their Patchwork/Upwelling notebooks cover this).
   - Braid-HTTP, for versioned HTTP resources and subscriptions: relevant to `@{ref}` and the no-JS/HTTP path.
   - The Kleppmann et al. interleaving-anomalies paper, for fractional indexes.
   - XEP-0284 SXE is already listed; summarise why it is not used.
6. **Naming — L.** "XML to XML Protocol" while the wire is binary Yrs updates will confuse readers. Say explicitly that XML is the *document model*, not the wire encoding. The Xmesh/Thinkbox and MUPPET/Henson notes are good; settle the public names before the gateway goes public.
7. **Status per section, not per page — L.** Several pages are "decided" at the top with open sub-points. Per-section badges (as `branches.mdx` does) would remove most of 1.22.
8. **Team model — L.** "Cross-language property tests, from day one" while only one implementation exists. Rephrase as "property tests against the vector suite, from day one".
