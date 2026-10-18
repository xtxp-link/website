---
title: Team model
description: A principal agent that owns the cross-cutting contract, and one expert per stack.
---

<span class="status status--decided">decided</span>

The build is organised as one **principal** and one **expert per stack**. Each expert answers to the shared test vectors, not to the other experts.

## Principal

Owns everything that crosses a boundary:

- CRDT semantics (The Math)
- the wire protocol (The Wire), and identity and access
- the BDD feature files and JSON vector suite
- property tests against the vector suite, from day one

## Experts

| Stack | Owns |
| --- | --- |
| **Engine (Rust)** | Xmesh on Yrs's XML types: node-kind mapping, XML Patch translation, canonical output, and its C and Wasm bindings |
| **Inkscape fork** | The muppet adapter inside Inkscape, and keeping the fork current |
| **muppet roles (Rust)** | Hosting (admission, grants, routing, storage, trust between sessions), its WebSocket endpoint, and the server-side muppet |
| **Wire and bridges** | The sync protocol's message encoding, and the XMPP bridge for mobile and chat clients (from M4) |
| **Web clients** | The Wasm muppet and the no-JS HTML client |

## Why this shape

The riskiest bugs in a system like this live *between* implementations: two engines that disagree by one tombstone. Giving the principal sole ownership of the vectors makes the agreement between implementations a deliverable, not a hope.
