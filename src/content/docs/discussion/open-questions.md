---
title: Open questions
description: What still needs deciding, with the options on the table.
---

## Q7. What does a Conversations user get in M4?

Stock Conversations can't render a canvas. The answer affects the protocol now: fallback bodies, and how comments map to chat messages.

1. **Chat only.** Canvas comments appear as room messages, and replies flow back as comments. Drawing operations are invisible.
2. **Chat plus a picture.** As 1, plus a server-side muppet posts a rendered snapshot to the room and keeps it current, optionally with the onion skin or redline of an open session. A reviewer could accept a proposal with a chat reply.
3. **A Conversations fork** with a muppet built in: a full mobile peer, and a second fork to maintain.
4. **Our own mobile client** following Conversations' XMPP practices.

*Current lean:* 2. It needs no client changes, and server-side rendering already exists for the no-JS path.

## Q9. Where does live web branching sit in the milestones?

M2's no-JS path is served by the host itself, so it doesn't need xtxp.link. Live web branching does raise the questions the [muppet disco](/spec/disco/) defers: who claims `@origin`, and which forks get listed.

1. After the muppet disco milestone, once domain owners can claim `@origin` and run a bouncer.
2. Earlier, on a single host, with forks of websites unlisted until discos exist.
3. Make web overlays the main product, with the Inkscape canvas as its first specialised client.

*No current lean;* to discuss.

## Q10. How does an engine merge several people's layers?

[Decision 27](/discussion/decisions/#27-a-muppet-executes-applications-drive-it) lets an engine own a space: a physics engine moving a drawing's parts is the first, in `xtxp-rs`. With one person it is simple. With several, each person's edits arrive as their own session, shown as an [onion skin](/overview/glossary/), and the engine has to decide what the shared space looks like.

1. **The engine merges.** Each person's layer is an input to the engine's step; it decides what holds, and writes the result into the shared session.
2. **Rubber-banding.** The engine refuses an edit that would leave the space invalid (a piece placed inside another, say) and snaps the position back, with the refusal confirmed to the person as [decision 26](/discussion/decisions/#26-the-browser-is-the-muppets-client) describes.
3. **No engine arbitration.** Layers merge like any sessions and the engine only reads the result.

Open inside this: whether an engine's step takes people's inputs as edits or as a separate stream, and how a late joiner's layer is replayed through the same rules. The first engine's step has no inputs yet; this is what they would plug into.

*No current lean;* to try with two people moving pieces of one drawing.

## Wire and addressing

- **Ref names:** whether `@main` or `@latest` names the shared session.
- **Snapshot hashes in URLs:** which hash, how short, and how it's written after `@`.
- **Native or website?** How a disco or client tells that `{host}` is a muppet rather than an ordinary site, for example a `/.well-known/` file or a DNS record.
- **`xtxp://` binding:** does it name the WebSocket binding directly, or resolve to it through a muppet disco?
- **Message framing:** how XTXP's own messages (identity, grants) sit alongside the Yjs sync messages and Yrs updates.
- **XMPP bridge envelope:** namespace, transit-safe encoding and fallback body for chat clients (from M4).
- **Media types:** reuse `application/xml-patch+xml` for patches; whether the stream needs a type of its own.
- **The wire format:** [decision 21](/discussion/decisions/#21-canonical-form-v0-and-one-wire-format-to-start) is a starting point; it needs further work.
- **How the XMPP bridge is built:** for example as a component plugged into an existing XMPP server, speaking XTXP to a host.

## Engine

- **A tree layer of our own:** after M2, reflect on closing v1's move gaps with a "moved to" link resolved when reading, or a node map with Wallace's cycle-safe moves (the `yrs_tree` crate, young at 0.4.x, implements the latter). See [later: a tree layer of our own](/spec/math/#later-a-tree-layer-of-our-own).
- **History and memory:** snapshots need Yrs's garbage collection off. How fast do documents grow, and when is the [roadmap](/build/milestones/#roadmap) ledger worth building?
- **Reusing y-sweet:** the review recommends borrowing from it rather than extending it ([decision 25](/discussion/decisions/#25-run-m1-and-m2-on-a-stock-y-sweet-first)). [M1-y-sweet and M2-y-sweet](/build/milestones/#m1-y-sweet-and-m2-y-sweet) test how far a stock y-sweet goes before XTXP's own host is decided.
- **Hosting later:** M1 runs as a self-hosted binary. Whether Cloudflare Workers with one Durable Object per session is worth it stays open; keeping each hosted session a pure actor with storage behind an interface allows both.

## Identity and access

- **Key storage:** where the private key lives in the user's own storage, and how it's protected (for example, encrypted with a passkey-derived key).
- **Admin rights:** a grantable `admin` role, so losing the creator's key doesn't freeze a session.
- **Several devices, one person:** a root key that signs per-device keys.
- **Provenance beyond the host:** occasional signed hash chains of each client's operations.
- **Key recovery** when every device and the backup are lost.

See [Identity and access](/spec/identity/#still-open).

## Hosting and sessions

- **Discovery:** how a host finds out which sessions on other hosts trust, or are trusted by, its own.
- **Website sessions:** an ordinary website isn't a muppet, so its sessions live on other hosts. How they appear under the website's address, through a disco, is part of the [muppet disco](/spec/disco/#still-open) design.
- **Duplicate ids after a merge:** the resolution algorithm, how a person is brought in, and whether partitioned ids such as `path-123` are worth an experiment. See [conflicts above the CRDT](/spec/sessions/#conflicts-above-the-crdt).
- **Trust management:** who may set up trust into a session (its owner only, or anyone with write access), and how trust is shown to collaborators.

## The muppet disco

A future milestone; see [its own list](/spec/disco/#still-open): federation rules and ActivityPub, a registrar for contestable session names, the TXT record for claiming `@origin`, and the signed query format.

## Use cases

The [use cases](/overview/use-cases/) are sketches. Each needs its rules for accepted and bounced edits worked out before it informs the protocol: user sessions especially, and how a personal session relates to an ordinary web session token.

## Inkscape and whiteboard behaviour

- **Undo, selection and presence** in a shared whiteboard: start from Inkboard's semantics, then compare with [tldraw and Miro](/discussion/prior-art/#tldraw-and-miro).

## Hosting safety

- **Rendering user documents:** sanitising, CSP and a separate origin for user content. Not the protocol's business, but every host serving other people's documents will need an answer. See [Addressing](/spec/addressing/#rendering-safety).

## The browser as client

- **View transitions for streamed patches:** whether a `<template for>` patch can start one declaratively, or needs one call to `document.startViewTransition()`.
- **SVG:** whether markers, `view-transition-name` and anchors work on elements inside inline `<svg>`, and the fallback where they don't.
- **When to stream:** how a host knows, without script, that a browser supports declarative partial updates.

See [The browser as client](/spec/browser/#still-open).

## Views

- **Onion skin semantics:** live in-flight edits from others, explicit suggestions to accept, or both?

## Web overlays

- **Stable node IDs** for re-fetched HTML.
- **Safety:** the [requirements](/spec/web-overlay/#safety-requirements) are listed; their implementation and policy aren't.

## Naming

- A public-facing name for the engine, given the Xmesh collision ([name checks](/brand/names/#name-checks)).
- Whether muppet survives a commercial launch, or the muppet disco going live. It's a lowercase keyword for now; see [the muppet advisory](/brand/names/#the-muppet-advisory).
