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

**Lessons, and where they show up:** keep the transport outside Inkscape's internals ([The Inkscape fork](/build/inkscape-fork/)); don't let XML payloads depend on XMPP framing ([The Wire](/spec/wire/#the-xmpp-bridge)); don't let a fork rot.

- [Inkscape wiki: WhiteBoard](https://wiki.inkscape.org/wiki/WhiteBoard)
- [Inkboard design document](https://inkboard.sourceforge.net/docs/DesignDocument.html)
- [Bob Jamison on Pedro 2 (inkscape-devel)](https://lists.inkscape.org/hyperkitty/list/inkscape-devel@lists.inkscape.org/message/HZWTNWGKNNPT5WX72ZQXRJQKQ3LBPOHQ)

### XEP-0284: Shared XML Editing (SXE)

An XMPP extension for synchronising XML documents between clients. Worth reviewing before the patch envelope is fixed.

## Merging edits

### YATA, Yjs and Yrs

YATA orders concurrent insertions in a sequence. Yjs implements it, including XML element and fragment types, and Yrs is its Rust port. Yrs is XTXP's [test oracle](/build/verification/). Neither has a native tree move.

- Nicolaescu et al., *Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types* (GROUP 2016)

### Replicated tree moves

Kleppmann, Mulligan, Gomes and Beresford, *A highly-available move operation for replicated trees* (IEEE TPDS, 2021). The basis for [moves in Xmesh](/spec/math/#moves-without-cycles).

### Loro

A Rust CRDT library with a native movable tree. It was considered as an engine and not adopted (see [decision 4](/discussion/decisions/#4-build-our-own-engine-with-an-oracle)).

## Sync protocols

### The Yjs sync protocol

Peers exchange state vectors, then send each other only the missing updates, over any transport, typically a plain WebSocket. XTXP's [reconnect sync](/spec/wire/#what-the-core-needs-from-a-transport) follows the same two-step shape, and keeps cursors and presence ("awareness") separate from document updates, as Yjs does.

- [y-protocols: PROTOCOL.md](https://github.com/yjs/y-protocols/blob/master/PROTOCOL.md)

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
