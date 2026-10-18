---
title: Open questions
description: What still needs deciding, with the options on the table.
---

## Q7. What does a Conversations user get in M4?

Stock Conversations can't render a canvas. The answer affects the protocol now: fallback bodies, and how comments map to chat messages.

1. **Chat only.** Canvas comments appear as room messages, and replies flow back as comments. Drawing operations are invisible.
2. **Chat plus a picture.** As 1, plus a server-side MUPPET posts a rendered snapshot to the room and keeps it current, optionally with the onion skin or redline of an open session. A reviewer could accept a proposal with a chat reply.
3. **A Conversations fork** with a MUPPET built in: a full mobile peer, and a second fork to maintain.
4. **Our own mobile client** following Conversations' XMPP practices.

*Current lean:* 2. It needs no client changes, and server-side rendering already exists for the no-JS path.

## Q9. Where does live web branching sit in the milestones?

M2's no-JS path is served by the host itself, so it doesn't need xtxp.link. Live web branching does raise the questions the [muppet disco](/spec/disco/) defers: who claims `@origin`, and which forks get listed.

1. After the muppet disco milestone, once domain owners can claim `@origin` and run a bouncer.
2. Earlier, on a single host, with forks of websites unlisted until discos exist.
3. Make web overlays the main product, with the Inkscape canvas as its first specialised client.

*No current lean;* to discuss.

## Wire and addressing

- **Ref names:** whether `@main` or `@latest` names the shared session.
- **State vectors in URLs:** a compact, readable way to write one after `@`.
- **Native or website?** How a disco or client tells that `{host}` is a MUPPET rather than an ordinary site, for example a `/.well-known/` file or a DNS record.
- **`xtxp://` binding:** does it name the WebSocket binding directly, or resolve to it through a muppet disco?
- **Message framing:** how XTXP's own messages (identity, grants) sit alongside the Yjs sync messages and Yrs updates.
- **XMPP bridge envelope:** namespace, transit-safe encoding and fallback body for chat clients (from M4).
- **Media types:** reuse `application/xml-patch+xml` for patches; register a vendor type for the stream.
- **How the XMPP bridge is built:** for example as a component plugged into an existing XMPP server, speaking XTXP to a host.

## Engine

- **Tree layer:** adopt the `yrs_tree` crate, which implements Wallace's algorithm on Yrs, or write our own on the same algorithm? `yrs_tree` is young (0.4.x).
- **History and memory:** snapshots need Yrs's garbage collection off. How fast do documents grow, and when is the [roadmap](/build/milestones/#roadmap) ledger worth building?
- **Reusing y-sweet:** how much of hosting it can provide. Decided by the [y-sweet review](/build/milestones/#before-m1-review-y-sweet) before implementation.
- **Hosting:** a single self-hosted Rust binary, or Cloudflare Workers with one Durable Object per session? Keeping each hosted session a pure actor with storage behind an interface allows both.
- **Canonical form:** the exact XML canonicalisation used before hashing.

## Identity and access

- **Key storage:** where the private key lives in the user's own storage, and how it's protected (for example, encrypted with a passkey-derived key).
- **Admin rights:** a grantable `admin` role, so losing the creator's key doesn't freeze a session.
- **Several devices, one person:** a root key that signs per-device keys.
- **Provenance beyond the host:** occasional signed hash chains of each client's operations.
- **Key recovery** when every device and the backup are lost.

See [Identity and access](/spec/identity/#still-open).

## Hosting and sessions

- **Discovery:** how a host finds out which sessions on other hosts trust, or are trusted by, its own.
- **Website sessions:** an ordinary website isn't a MUPPET, so its sessions live on other hosts. How they appear under the website's address, through a disco, is part of the [muppet disco](/spec/disco/#still-open) design.
- **Trust management:** who may set up trust into a session (its owner only, or anyone with write access), and how trust is shown to collaborators.

## The muppet disco

A future milestone; see [its own list](/spec/disco/#still-open): federation rules and ActivityPub, a registrar for contestable session names, the TXT record for claiming `@origin`, and the signed query format.

## Use cases

The [use cases](/overview/use-cases/) are sketches. Each needs its rules for accepted and bounced edits worked out before it informs the protocol: user sessions especially, and how a personal session relates to an ordinary web session token.

## Views

- **Onion skin semantics:** live in-flight edits from others, explicit suggestions to accept, or both?

## Web overlays

- **Stable node IDs** for re-fetched HTML.
- **Safety:** the [requirements](/spec/web-overlay/#safety-requirements) are listed; their implementation and policy aren't.

## Naming

- A public-facing name for the engine, given the Xmesh collision.
- Whether MUPPET stays internal.
