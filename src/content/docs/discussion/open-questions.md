---
title: Open questions
description: What still needs deciding, with the options on the table.
---

## Q7. What does a Conversations user get in M4?

Stock Conversations can't render a canvas. The answer affects the protocol now: fallback bodies, and how comments map to chat messages.

1. **Chat only.** Canvas comments appear as room messages, and replies flow back as comments. Drawing operations are invisible.
2. **Chat plus a picture.** As 1, plus a server-side MUPPET posts a rendered snapshot to the room and keeps it current, optionally with the onion skin or redline of an open branch. A reviewer could accept a proposal with a chat reply.
3. **A Conversations fork** with a MUPPET built in: a full mobile peer, and a second fork to maintain.
4. **Our own mobile client** following Conversations' XMPP practices.

*Current lean:* 2. It needs no client changes, and server-side rendering already exists for the no-JS path.

## Q9. Where does the web gateway sit in the milestones?

1. A separate M5 after the canvas milestones.
2. Fold it into M2: the no-JS path *is* the gateway, so M2 serves SVG documents at xtxp.link first and arbitrary web pages later.
3. Make web overlays the main product, with the Inkscape canvas as its first specialised client.

*Current lean:* 2.

## Wire and addressing

- **`xtxp://` binding:** does it resolve to an XMPP room (as `xmpp:` URIs do, RFC 5122), or does XTXP get its own socket binding?
- **Patch envelope:** namespace, transit-safe encoding, fallback body, branch routing.
- **Media types:** reuse `application/xml-patch+xml` for patches; register a vendor type for the stream.
- **Trackers and the XMPP server:** run trackers inside an Erlang XMPP server (ejabberd, MongooseIM), or alongside one?

## Engine

- **Identity:** mapping CRDT client IDs to JIDs and devices, and whether operations are signed.
- **Garbage collection:** when tombstones can be dropped if the relay may be blind and no server sees every peer.
- **Canonical form:** the exact XML canonicalisation used before hashing.

## Views

- **Onion skin semantics:** live in-flight edits from others, explicit suggestions to accept, or both?

## Web overlays

- **Stable node IDs** for re-fetched HTML.
- **Safety:** the [requirements](/spec/web-overlay/#safety-requirements) are listed; their implementation and policy aren't.

## Naming

- A public-facing name for the engine, given the Xmesh collision.
- Whether MUPPET stays internal.
