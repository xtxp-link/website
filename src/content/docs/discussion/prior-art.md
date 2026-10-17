---
title: Prior art
description: The earlier work XTXP builds on, what each piece teaches, and further reading.
---

XTXP borrows from more than twenty years of work on collaborative editing, messaging and identity. Each section says what we take from it and where it shows up in the spec.

## Where XTXP comes from

### David Campey's 2005 JEP

An experimental Jabber Enhancement Proposal for message and document updates over XMPP, aimed at replacing HTTP. XTXP is its second run. See [North star](/overview/north-star/#roots). The original text is still being tracked down.

### Inkboard and Pedro

A 2004 project to turn Inkscape into a shared whiteboard. It sent changes to Inkscape's XML document over a custom Jabber namespace to other Inkscape instances. It lived in a branch, was disabled in Inkscape 0.47 because it was broken, and never synchronised `defs` or metadata.

Bob Jamison, who wrote Pedro (the XMPP library Inkboard used), later said he had misconceptions about XMPP as an XML transport. He had ideas for carrying an XML fragment without damaging it in transit, and favoured decoupling the XMPP agent from Inkscape.

**Its code is a starting point** for the Inkscape adapter: see [Start from Inkboard's code](/build/inkscape-fork/#start-from-inkboards-code).

**Lessons, and where they show up:** keep the transport outside Inkscape's internals ([The Inkscape fork](/build/inkscape-fork/)); don't let XML payloads depend on XMPP framing ([The Wire](/spec/wire/#the-xmpp-bridge)); don't let a fork rot.

- [Inkscape wiki: WhiteBoard](https://wiki.inkscape.org/wiki/WhiteBoard)
- [Inkboard design document](https://inkboard.sourceforge.net/docs/DesignDocument.html)
- [Inkboard software manual (PDF)](https://inkboard.sourceforge.net/docs/SoftwareManual.pdf)
- [Initial commit of Inkboard code (inkscape-devel, 2005)](https://lists.inkscape.org/hyperkitty/list/inkscape-devel@lists.inkscape.org/thread/PBKG5RKK2ZBMRBHLEKMRQB63CZTQFZZZ/)
- [Inkscape 0.46 source, with `src/jabber_whiteboard` and `src/pedro` (Bazaar)](https://bazaar.launchpad.net/~inkscape.dev/inkscape/RELEASE_0_46_BRANCH/files/13676/src)
- [Bob Jamison on Pedro 2 (inkscape-devel)](https://lists.inkscape.org/hyperkitty/list/inkscape-devel@lists.inkscape.org/message/HZWTNWGKNNPT5WX72ZQXRJQKQ3LBPOHQ)

### XEP-0284: Shared XML Editing (SXE)

An XMPP extension for synchronising XML documents between clients. Worth reviewing before the patch envelope is fixed.

## Merging edits

### YATA, Yjs and Yrs

YATA orders concurrent insertions in a sequence. Yjs implements it, including XML element and fragment types, and Yrs is its Rust port. **Xmesh v1 is built on Yrs** ([decision 13](/discussion/decisions/#13-xmesh-v1-is-yrs-plus-a-tree-layer)). Neither has a native tree move, which is what Xmesh adds.

Yrs already reaches every place XTXP runs: `yffi` exposes it to C, and it compiles to Wasm. Xmesh follows the same patterns for its own bindings.

- Nicolaescu et al., *Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types* (GROUP 2016)
- [`yffi` (C bindings for Yrs)](https://docs.rs/crate/yffi/latest)

### Cycle-safe tree moves

**Evan Wallace's mutable tree hierarchy** gives each node a map of every parent it has had, with counters; the highest counter wins, and nodes caught in a cycle are reattached deterministically when the tree is read. It needs only ordinary map writes, so it fits Yrs. The basis for [moves in Xmesh](/spec/math/#moves-without-cycles). The **`yrs_tree`** crate implements it on Yrs.

**Kleppmann, Mulligan, Gomes and Beresford**, *A highly-available move operation for replicated trees* (IEEE TPDS, 2021), solves the same problem by undoing and replaying operations in timestamp order.

Loro's write-up compares movable-tree approaches.

- [Evan Wallace: CRDT mutable tree hierarchy](https://madebyevan.com/algos/crdt-mutable-tree-hierarchy/)
- [`yrs_tree` on docs.rs](https://docs.rs/crate/yrs_tree/latest)
- [Loro: movable tree CRDTs](https://www.loro.dev/blog/movable-tree)

### Loro

A Rust CRDT library with a native movable tree. Xmesh builds on Yrs instead, for the larger Yjs ecosystem and Yrs's existing C bindings.

## Sync protocols

### The Yjs sync protocol

Peers exchange state vectors, then send each other only the missing updates, over any transport, typically a plain WebSocket. XTXP's [reconnect sync](/spec/wire/#what-the-core-needs-from-a-transport) follows the same two-step shape, and keeps cursors and presence ("awareness") separate from document updates, as Yjs does.

- [y-protocols: PROTOCOL.md](https://github.com/yjs/y-protocols/blob/master/PROTOCOL.md)

### y-sweet

An open-source Rust server for Yjs documents, built on Yrs, from Jamsocket. It persists documents to a filesystem or S3-compatible storage, controls access per document with client tokens, and can run as a binary or as Wasm on Cloudflare's edge. Much of what an XTXP tracker needs; [reviewed for reuse](/build/milestones/#before-m1-review-y-sweet) before tracker code is written.

- [y-sweet on docs.rs](https://docs.rs/crate/y-sweet/0.8.2)

### Conversations and mobile XMPP

The Android XMPP client at conversations.im. It shaped XTXP's early design, and its practices now live in the [XMPP bridge](/spec/wire/#the-xmpp-bridge): stream management, archive, client state and push for unreliable mobile links, and end-to-end encryption in the chat stream.

## Identity and access

### SSH keys and Nostr

In both, a public key *is* the identity, with no central account. XTXP takes the same view ([Identity and access](/spec/identity/#a-user-is-a-public-key)).

- [Nostr protocol (NIPs)](https://github.com/nostr-protocol/nips)

### UCAN

User-Controlled Authorization Networks: permissions granted to public keys and delegated by signed tokens, with no central server. A reference point for grants and delegation if XTXP adds an `admin` role.

- [UCAN specification](https://github.com/ucan-wg/spec)

### Keyhive (Ink & Switch)

Research on access control for local-first software: groups, delegation and revocation that work without a central authority, alongside CRDT sync. The closest prior art to XTXP's grants and revocation, and worth reading before the details are fixed.

- [Keyhive lab notebook](https://www.inkandswitch.com/keyhive/notebook/)

### Passkeys and the WebAuthn PRF extension

The PRF extension lets a passkey derive a secret that can encrypt other data, such as a stored private key. One candidate for protecting the user's key in [their own storage](/spec/identity/#still-open). Practitioners caution that losing the passkey then means losing the data.

- [Bitwarden: PRF, WebAuthn and passkeys](https://bitwarden.com/blog/prf-webauthn-and-its-role-in-passkeys/)
- [A caution against using PRF to encrypt data](https://lilting.ch/en/articles/passkeys-prf-extension-encryption-risk)

## Undo and history

### Inkscape's undo stack

Inkscape undoes at the level of its XML tree, which makes it directly relevant to XTXP:

- **An action is a transaction.** Every change to the document's XML is recorded as an event (node added, removed or reordered; attribute or content changed). `DocumentUndo::done()` closes the open transaction and pushes its event log onto the undo stack as one step, with a description for the Undo History dialog.
- **Undo and redo replay logs.** Undo reverses a step's XML events; redo replays them forward.
- **Small steps can merge.** `DocumentUndo::maybeDone()` takes a key. If it matches the previous action's key, the new events are folded into the top step, so winding a spin button becomes one undo. Drags write to the XML only on release, so a drag is one step too.
- **History is linear.** Any new action clears the redo stack: `maybeDone()` calls `clearRedo()` before pushing the new step, which is still the case in current Inkscape. Undo a few steps, then edit, and the undone work is gone.
- **Observers can watch commits.** An `UndoStackObserver` is told about each new step, undo and redo.
- **The Undo History dialog nests, but doesn't branch.** Its model (`EventLog`) shows history as a tree, and its source calls the nesting "branches". When a new step has the same kind as the previous one, it's added as a child of that row, so a run of moves collapses under one entry. These are groups of consecutive actions, not alternative histories: `_clearRedo()` erases every row after the current one, children included.
- **Jumping is replay.** Selecting a row in the dialog (`seekTo()`) calls undo or redo repeatedly until it gets there.
- **History is bounded.** The oldest steps expire from the front of the stack, and the dialog then shows "[Changes forgotten]". A reference point for XTXP's [history limits](/build/milestones/#roadmap).

**What XTXP takes from it:**

- **The capture point for the Inkscape fork.** Hooking the transaction commit turns each Inkscape action into one batch of XTXP operations, already grouped the way a user thinks of their edits ([The Inkscape fork](/build/inkscape-fork/)).
- **What branches fix.** Where Inkscape clears redo, XTXP forks: undoing and then editing starts a [branch](/spec/branches/#undo-in-practice), and the undone work stays reachable.

- [`document-undo.cpp` (current Inkscape source, code docs)](https://inkscape.gitlab.io/inkscape/doxygen/document-undo_8cpp_source.html)
- `event-log.cpp` (Undo History model; Gustav Broberg, Jon A. Cruz; GPL-2.0-or-later): [code docs](https://inkscape.gitlab.io/inkscape/doxygen/event-log_8cpp_source.html)
- [`document-undo.cpp` (2017 revision, Bazaar)](https://bazaar.launchpad.net/~inkscape.dev/inkscape/trunk/view/15731/src/document-undo.cpp)
- [Inkscape wiki: Architectural overview](https://wiki.inkscape.org/wiki/Architectural_overview)

### Undo in shared documents

Yjs and Yrs have an undo manager that can be scoped to the local user's own changes: it undoes them by applying inverse operations, and leaves collaborators' edits alone. That is the model for an individual's Ctrl+Z in a shared XTXP document, as distinct from branching the document's history.

## Addressing and branching

### Git

Branches as cheap forks of history, merges as replays, `origin` as the authoritative upstream. XTXP's [branches](/spec/branches/) and the [`@origin` ref](/spec/addressing/#one-address-form) borrow all three ideas.

### `package@version`

npm and similar tools name a version after an `@` (`react@18.3.1`, `pkg@latest`). XTXP's `{host}/{path}@{ref}` reads the same way.

### The HTTP origin server

HTTP calls the server that holds the authoritative version of a resource the *origin server*, and browsers build their security model around a page's *origin*. Hence `@origin`.

- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)

## Seeing edits before they merge

### Onion skinning

From traditional animation: drawing on translucent paper over the previous frames. XTXP uses the term for drawing a branch or pending edits over the current state ([Views](/spec/views/)).

### Tracked changes

Word processors' redlines, which show who changed what, before it's accepted. XTXP's redline is the same idea, computed from branch operations.

## Web overlays

- **Hypothesis `via`** proxies any page to add an annotation layer. A working model for overlays done responsibly.
- **Genius Web Annotator** overlaid annotations on other people's sites and drew sustained criticism from site owners about consent. A cautionary tale for [live web branching](/spec/web-overlay/).

## Standards

- RFC 5261: XML Patch operations
- RFC 7351: the `application/xml-patch+xml` media type
- RFC 9110: HTTP semantics, including the origin server
- RFC 5122: `xmpp:` URIs
- XEP-0045 (Multi-User Chat), XEP-0198 (Stream Management), XEP-0313 (Message Archive Management), XEP-0352 (Client State Indication), XEP-0357 (Push Notifications), XEP-0308 (Last Message Correction)
