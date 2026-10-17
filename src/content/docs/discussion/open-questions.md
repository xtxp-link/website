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

- **Ref names:** whether `@main` or `@latest` names the shared branch. (`@origin` was chosen over `@live`, `@upstream` and `@web` for the website's authoritative version.)
- **State vectors in URLs:** a compact, readable way to write one after `@`.
- **Native or website?** How the gateway tells that `{host}` is an XTXP node rather than an ordinary site, for example a `/.well-known/` file or a DNS record.
- **`xtxp://` binding:** does it name the WebSocket binding directly, or resolve to it through the gateway?
- **Message encoding:** the binary format of operations and the framing of each wire message.
- **XMPP bridge envelope:** namespace, transit-safe encoding and fallback body for chat clients (from M4).
- **Media types:** reuse `application/xml-patch+xml` for patches; register a vendor type for the stream.
- **Where the XMPP bridge runs:** inside an Erlang XMPP server (ejabberd, MongooseIM), or alongside one?

## Engine

- **Tree layer:** adopt the `yrs_tree` crate, which implements Wallace's algorithm on Yrs, or write our own on the same algorithm? `yrs_tree` is young (0.4.x).
- **History and memory:** snapshots need Yrs's garbage collection off. How fast do documents grow, and when is the [roadmap](/build/milestones/#roadmap) ledger worth building?
- **NIF safety:** trackers load Xmesh as a Rust NIF. Long operations need dirty schedulers so they don't stall the BEAM.
- **Canonical form:** the exact XML canonicalisation used before hashing.

## Identity and access

- **Key storage:** where the private key lives in the user's own storage, and how it's protected (for example, encrypted with a passkey-derived key).
- **Admin rights:** a grantable `admin` role, so losing the creator's key doesn't freeze a branch.
- **Several devices, one person:** a root key that signs per-device keys.
- **Provenance beyond the tracker:** occasional signed hash chains of each client's operations.
- **Key recovery** when every device and the backup are lost.

See [Identity and access](/spec/identity/#still-open).

## Views

- **Onion skin semantics:** live in-flight edits from others, explicit suggestions to accept, or both?

## Web overlays

- **Stable node IDs** for re-fetched HTML.
- **Safety:** the [requirements](/spec/web-overlay/#safety-requirements) are listed; their implementation and policy aren't.

## Naming

- A public-facing name for the engine, given the Xmesh collision.
- Whether MUPPET stays internal.
