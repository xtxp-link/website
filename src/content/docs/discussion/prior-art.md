---
title: Prior art
description: The earlier work XTXP builds on, what each piece teaches, and further reading.
---

XTXP borrows from more than twenty years of work on collaborative editing, messaging and identity. Each section says what we take from it and where it shows up in the spec.

## Where XTXP comes from

### Tim Berners-Lee's WorldWideWeb

The first browser (1990) was also an editor, though only for local files, since HTTP `PUT` wasn't implemented yet. The read-write web XTXP aims for. See [North star](/overview/north-star/#roots).

- [W3C: The WorldWideWeb browser](https://www.w3.org/People/Berners-Lee/WorldWideWeb.html)

### David Campey's 2005 JEP

An experimental Jabber proposal for streaming document updates over XMPP, aimed at replacing HTTP, developed in conversation with Jabber folk such as Peter Saint-Andre. Part of the line XTXP comes from; see [North star](/overview/north-star/#roots).

### Local-first software

Ink & Switch's case for collaborative software that works offline, keeps data on the user's own devices and syncs through CRDTs instead of a central server. XTXP's peers, sessions and pure engine follow it.

- [Ink & Switch: Local-first software](https://www.inkandswitch.com/local-first/)

### "Surprise, it's server rendering" and declarative partial updates

Schalk Venter's PyCon ZA talk on browser features that make server-rendered sites feel live without a JavaScript framework: CSS View Transitions, the Popover API, Speculation Rules and declarative partial updates, which let HTML stream into the page out of order and fill marked placeholders later, with no script. The debate it started, about streaming site content without JavaScript polyfills, led to XTXP.

- [PyCon ZA: Surprise, it's server rendering](https://za.pycon.org/talks/4-suprise-its-server-rendering/)
- [Chrome for Developers: Declarative partial updates](https://developer.chrome.com/docs/web-platform/declarative-partial-updates)

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

YATA orders concurrent insertions in a sequence. Yjs implements it, including XML element and fragment types, and Yrs is its Rust port. **Xmesh v1 is built on Yrs** ([decision 13](/discussion/decisions/#13-xmesh-v1-is-a-thin-layer-on-yrs)). Xmesh v1 uses Yrs's XML types directly. Neither Yjs nor Yrs has a native tree move, which is the main thing a later tree layer of our own would add.

Yrs already reaches every place XTXP runs: `yffi` exposes it to C, and it compiles to Wasm. Xmesh follows the same patterns for its own bindings.

Yrs is released steadily; Xmesh uses 0.28 (September 2026). Fixes since 0.19 matter to XTXP: a delete set lost after applying an update (0.27.2), a missing right neighbour when inserting at index 0 (0.27.3), a swallowed pending update (0.27.1), and decoders hardened against malformed updates (0.28.0). Version 0.27 dropped Yrs's array move, which XTXP never used. Building Xmesh found that 0.28 can still leave a pending update stuck after everything it depends on has arrived; Xmesh re-applies such updates until nothing is missing.

- Nicolaescu et al., *Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types* (GROUP 2016)
- [`yffi` (C bindings for Yrs)](https://docs.rs/crate/yffi/latest)
- [y-crdt on GitHub](https://github.com/y-crdt/y-crdt)

### Cycle-safe tree moves

**Evan Wallace's mutable tree hierarchy** gives each node a map of every parent it has had, with counters; the highest counter wins, and nodes caught in a cycle are reattached deterministically when the tree is read. It needs only ordinary map writes, so it fits Yrs. One basis for [a later tree layer of our own](/spec/math/#later-a-tree-layer-of-our-own); v1 moves are copies. The **`yrs_tree`** crate implements it on Yrs.

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

An open-source Rust server for Yjs documents, built on Yrs, from Jamsocket (MIT). It persists each document as one snapshot to a filesystem or S3-compatible storage, and controls access per document with bearer tokens, full or read-only. It runs as a binary; its Wasm build for Cloudflare's edge is deprecated. Its core authors stopped committing in 2025, and v0.9.1 (September 2025) is the latest release.

It runs Yrs 0.19.2, which loses a delete that arrives before the insert it deletes, so deleted content can come back when updates arrive out of order. XTXP borrows from y-sweet rather than extending it, and runs M1 and M2 on it as is first ([decision 25](/discussion/decisions/#25-run-m1-and-m2-on-a-stock-y-sweet-first)).

- [y-sweet on GitHub](https://github.com/jamsocket/y-sweet)
- [y-sweet on docs.rs](https://docs.rs/crate/y-sweet/0.9.1)

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
- **What sessions fix.** Where Inkscape clears redo, XTXP forks: undoing and then editing starts a [session](/spec/sessions/#undo-in-practice), and the undone work stays reachable.

- [`document-undo.cpp` (current Inkscape source, code docs)](https://inkscape.gitlab.io/inkscape/doxygen/document-undo_8cpp_source.html)
- `event-log.cpp` (Undo History model; Gustav Broberg, Jon A. Cruz; GPL-2.0-or-later): [code docs](https://inkscape.gitlab.io/inkscape/doxygen/event-log_8cpp_source.html)
- [`document-undo.cpp` (2017 revision, Bazaar)](https://bazaar.launchpad.net/~inkscape.dev/inkscape/trunk/view/15731/src/document-undo.cpp)
- [Inkscape wiki: Architectural overview](https://wiki.inkscape.org/wiki/Architectural_overview)

### Undo in shared documents

Yjs and Yrs have an undo manager that can be scoped to the local user's own changes: it undoes them by applying inverse operations, and leaves collaborators' edits alone. That is the model for an individual's Ctrl+Z in a shared XTXP document, as distinct from branching the document's history.

### tldraw and Miro

Modern shared whiteboards: tldraw, an open-source canvas with multiplayer sync, and Miro. How they handle undo with several people editing, selection, and seeing each other's work are the questions to check against before settling XTXP's whiteboard behaviour in Inkscape ([the adapter contract](/build/inkscape-fork/#the-adapter-contract)).

## Addressing and branching

### Git

Branches as cheap forks of history, merges as replays, `origin` as the authoritative upstream. XTXP's [sessions](/spec/sessions/) and the [`@origin` ref](/spec/addressing/#one-address-form) borrow all three ideas.

### `package@version`

npm and similar tools name a version after an `@` (`react@18.3.1`, `pkg@latest`). XTXP's `{host}/{path}@{ref}` reads the same way.

### The HTTP origin server

HTTP calls the server that holds the authoritative version of a resource the *origin server*, and browsers build their security model around a page's *origin*. Hence `@origin`.

- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)

## Discovery and federation

### Mastodon and ActivityPub

ActivityPub is the W3C protocol behind the fediverse. Mastodon runs it as independent instances, each with its own rules and moderation, that choose whom to federate with. That is the model for how [muppet discos](/spec/disco/) might federate, and ActivityPub might even carry it.

- [W3C: ActivityPub](https://www.w3.org/TR/activitypub/)

### Claiming a domain by DNS record

Proving control of a domain with a DNS record is well established. ACME's DNS-01 challenge does it to issue certificates, and Bluesky lets an account claim a domain as its handle with a TXT record that names its identifier. A domain owner [claiming `@origin`](/spec/disco/#domain-owners-and-the-bouncer) by public key works the same way.

- [RFC 8555: ACME](https://www.rfc-editor.org/rfc/rfc8555)

## Use cases

Precedents for the [use cases](/overview/use-cases/):

- **Wikipedia** for merge rules layered on open editing: who may edit, how edits are reviewed, how disputes are settled.
- **Everything2** for a different take on who writes what and how it's kept.
- **MUDs, MUSHes and MOOs**, such as LambdaMOO, where users added their own objects, with logic, to a shared text world.
- **WorkAdventure**, a shared 2D world for teams, as a candidate for base maps with per-user layers.
- **Google Docs**, which defined the shared document editor.

## Seeing edits before they merge

### Onion skinning

From traditional animation: drawing on translucent paper over the previous frames. XTXP uses the term for drawing a session or pending edits over the current state ([Views](/spec/views/)).

### Tracked changes

Word processors' redlines, which show who changed what, before it's accepted. XTXP's redline is the same idea, computed from a session's operations.

## Web overlays

- **Hypothesis `via`** proxies any page to add an annotation layer. A working model for overlays done responsibly.
- **Genius Web Annotator** overlaid annotations on other people's sites and drew sustained criticism from site owners about consent. A cautionary tale for [live web branching](/spec/web-overlay/).

## Standards

- RFC 5261: XML Patch operations
- RFC 7351: the `application/xml-patch+xml` media type
- RFC 9110: HTTP semantics, including the origin server
- RFC 5122: `xmpp:` URIs
- XEP-0045 (Multi-User Chat), XEP-0198 (Stream Management), XEP-0313 (Message Archive Management), XEP-0352 (Client State Indication), XEP-0357 (Push Notifications), XEP-0308 (Last Message Correction)
