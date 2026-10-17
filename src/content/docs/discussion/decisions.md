---
title: Decision log
description: What has been settled so far, in the order it was settled.
---

Each entry records what was decided, plus what it replaced where relevant.

## 1. Relays and peers

The room server is a **relay**: it orders and archives operations, and it may be blind. **Peers** run the CRDT engine.

*Replaced:* a server that validated every patch through a C++ process before accepting it.

## 2. The no-JS client is a puppet

A plain HTML browser drives a **server-side MUPPET**, which turns form POSTs into real CRDT operations and acts for that one user. Because it can be one of the user's own devices, end-to-end encrypted rooms stay possible.

## 3. Elixir: a pure core as well as C++

A **pure Elixir Xmesh** powers trackers and server-side MUPPETs. **C++ is the reference implementation.** Cross-language property tests are the contract between them, owned by the principal from day one.

## 4. Build our own engine, with an oracle

Xmesh is our own implementation (YATA plus Kleppmann-style moves). The fuzzer also replays the non-move subset through **Yrs** as an independent correctness check.

*Considered:* adopting Yrs (no native tree move; we'd have to match the Yjs binary format in Elixir), or Loro (native moves, but a hard pure-Elixir port).

## 5. Inkscape: a maintained fork

With a separate engine repository, scheduled rebases and a tracked diff size. See [The Inkscape fork](/build/inkscape-fork/).

## 6. Milestones

M1 headless convergence → M2 Inkscape plus no-JS → M3 Inkscape plus Wasm → M4 Inkscape plus Conversations. See [Milestones](/build/milestones/).

## 7. Peer model with branch trackers

- **MUPPET is client-side Xmesh.** No server "finalises" state.
- **XTXP is node to node.**
- **A server-side branch is a new Erlang process** (a tracker), and a branch is a fork of the undo history.
- **Server-side rendering is a server-side MUPPET.** Trackers hold history, MUPPETs execute and render.

*Replaced:* an earlier description in which Xmesh resolved state centrally and broadcast a "finalised canonical state".

## 8. Convector is subsumed into MUPPET

There is no separate application layer. The vector canvas and the spatial chat and comments are MUPPET views, provided wherever a MUPPET runs (Inkscape, Wasm, server).

*Replaced:* Convector as a named application built on top of MUPPET.

## Naming

- **XTXP** for the protocol, **Xmesh** for the engine, **MUPPET** for the executor and application layer, **Erlang Trackers** for the routing layer.
- Name checks so far: *Xmesh* collides with Thinkbox XMesh, a commercial mesh-caching plugin for VFX tools. *Muppet* is a Henson/Disney trademark: fine for an internal component, riskier on anything public-facing. No direct clash was found for *XTXP*.

## Corrections carried forward

- Patch operations are defined by **RFC 5261**. RFC 7351 registers the media type.
- Moves skip whichever move would close a cycle in timestamp order, not "the older intent".
- "Lamport vector clock" conflated two things: per-client Lamport-style counters for IDs, and state vectors for what a peer has seen.
