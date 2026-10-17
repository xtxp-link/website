---
title: Decision log
description: The decisions currently in force, in the order they were made.
---

This log lists only the decisions currently in force. Numbers stay stable so links keep working, which means gaps mark decisions that were later replaced. Each entry notes what it replaced.

## 1. Relays and peers

**Trackers** relay: they admit, order and pass on operations, and they may be blind to content. **Peers** run the CRDT engine.

*Replaced:* a server that validated every patch through a C++ process before accepting it.

## 2. The no-JS client is a puppet

A plain HTML browser drives a **server-side MUPPET**, which turns form POSTs into real CRDT operations and acts for that one user. Because it can be one of the user's own devices, end-to-end encrypted rooms stay possible.

## 5. Inkscape: a maintained fork

With a separate engine repository, scheduled rebases and a tracked diff size. See [The Inkscape fork](/build/inkscape-fork/).

## 6. Milestones

A y-sweet review → M1 headless convergence → M2 Inkscape plus no-JS → M3 Inkscape plus Wasm → M4 Inkscape plus Conversations. See [Milestones](/build/milestones/).

## 7. Peer model with branch trackers

- **MUPPET is client-side Xmesh, and the application layer.** No server "finalises" state. The vector canvas, spatial chat and comments are MUPPET views, wherever a MUPPET runs.
- **XTXP is node to node.**
- **A server-side branch is held by a tracker**, one actor per branch, and a branch is a fork of the undo history.
- **Server-side rendering is a server-side MUPPET.** Trackers hold history, MUPPETs execute and render.

*Replaced:* an earlier description in which Xmesh resolved state centrally and broadcast a "finalised canonical state".

## 9. One address form: `{host}/{path}@{ref}`

Every document, native or an ordinary website, is addressed as `xtxp.link/{host}/{path}@{ref}`. There is no proxy marker: a website is a document whose upstream peer is the origin, and `@origin` is that peer's branch (chosen over `@live`, which suggested streaming rather than authority). The last `@` always starts the ref, and generated links always carry one. A first path segment without a dot is a gateway keyword. See [Addressing](/spec/addressing/).

*Replaced:* a `/@/` proxy marker (briefly adopted the same day) and a `?at=` placeholder for state vectors.

## 11. Transport: WebSocket first, XMPP as a bridge

XTXP's wire is a small sync protocol that doesn't care about transport: operations need only arrive eventually, at least once, in any order, and reconnecting is a state-vector exchange built into XTXP. Its bindings are **WebSocket** (primary, for raw speed), **HTTP** (no-JS browsers, through a server-side MUPPET) and an **XMPP bridge** for mobile and chat clients from M4. Cursors and presence travel as separate, never-archived messages. See [The Wire](/spec/wire/).

*Replaced:* XMPP rooms as the transport for every operation, with stream management and the archive providing resumption.

## 12. Identity is a public key; access is granted by key

A user is a public key, authenticated by signing a challenge. Signing in with an existing account (Google, Apple, Mozilla) fetches the private key from the user's own storage. Signatures happen only at identity steps: connecting, binding a client ID to a key, and granting or revoking access. Whoever creates a branch owns it and grants `read` or `write` to keys or to `*`. A tracker enforces grants on arrival, and **revocation closes the door to new edits on arrival**, because judging by claimed history position would let a revoked user backdate edits. Late edits land on a fork the revoked user owns. See [Identity and access](/spec/identity/).

*Replaced:* XMPP addresses (JIDs) as identity, which are easily confused with email addresses.

## 13. Xmesh v1 is Yrs plus a tree layer

The first Xmesh is a thin, pure Rust layer on **Yrs** rather than a new engine. Yrs supplies YATA ordering, maps, text, state vectors, a binary update format, snapshots and a sync protocol. Xmesh adds an XML tree schema (a map of nodes with parent pointers and fractional indexes), **cycle-safe moves after Evan Wallace's algorithm**, XML Patch translation and canonical XML output. It stays a pure core, reached through a C interface (Inkscape), Wasm (browser) and Rust directly (server MUPPET and trackers). A native C++ engine becomes a later spike, held to the same vectors.

*Replaced:* our own C++ engine with Yrs as an oracle, a parallel pure Elixir engine, trackers driving the engine through Ports, and Kleppmann's undo-and-replay moves.

## 14. Toolchain first: ledger and keyframes go on the roadmap

Branches persist the way the Yrs toolchain already does: a full state encoded as one update for loading, and append-then-compact storage. A dedicated ledger and keyframes are on the [roadmap](/build/milestones/#roadmap), to be built only if that falls short.

*Replaced:* trackers with a hot keyframe and a cold ledger from day one.

## 15. One language: trackers in Rust; Elixir dropped

With Xmesh in Rust, trackers are a small Rust server: one async actor per branch, a WebSocket endpoint, admission and grants, and append-then-compact storage, with the server-side MUPPET in the same binary. That removes a second language, toolchain and deploy, and the native-extension boundary. **y-sweet**, a Rust server for Yjs documents, is reviewed for reuse before implementation. Elixir/BEAM moves to the roadmap, to revisit only if scale calls for its supervision and clustering.

*Replaced:* Erlang trackers embedding Xmesh as a Rust NIF, and the pure Elixir engine spike.

## Naming

- **XTXP** for the protocol, **Xmesh** for the engine, **MUPPET** for the executor and application layer, **Trackers** for the routing layer (originally "Erlang Trackers").
- Name checks so far: *Xmesh* collides with Thinkbox XMesh, a commercial mesh-caching plugin for VFX tools. *Muppet* is a Henson/Disney trademark: fine for an internal component, riskier on anything public-facing. No direct clash was found for *XTXP*.

## Corrections carried forward

- Patch operations are defined by **RFC 5261**. RFC 7351 registers the media type.
- "Lamport vector clock" conflated two things: per-client Lamport-style counters for IDs, and state vectors for what a peer has seen.
