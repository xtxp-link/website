---
title: Team model
description: A principal agent that owns the cross-cutting contract, and one expert per stack.
---

<span class="status status--decided">decided</span>

The build is organised as one **principal** and one **expert per stack**. Each expert answers to the shared test vectors, not to the other experts.

## Principal

Owns everything that crosses a boundary:

- CRDT semantics (The Math)
- the wire protocol (The Wire)
- the BDD feature files and JSON vector suite
- cross-language property tests, from day one

## Experts

| Stack | Owns |
| --- | --- |
| **C++20 core + Wasm** | The Xmesh reference implementation and its Wasm build |
| **Inkscape fork** | The MUPPET adapter inside Inkscape, and keeping the fork current |
| **Elixir / BEAM** | The trackers, the XMPP integration, and hosting the C++ core through Ports. The pure Elixir Xmesh port is a later spike. |
| **XMPP** | Rooms, archive, stream management, the patch envelope and namespaces |
| **Web clients** | The Wasm MUPPET and the no-JS HTML client |

## Why this shape

The riskiest bugs in a system like this live *between* implementations: two engines that disagree by one tombstone. Giving the principal sole ownership of the vectors makes the agreement between implementations a deliverable, not a hope.
