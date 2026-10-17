---
title: Prior art
description: Earlier systems XTXP learns from, and what each one teaches.
---

## David Campey's 2005 JEP

An experimental Jabber Enhancement Proposal for message and document updates over XMPP, aimed at replacing HTTP. XTXP is its second run. See [North star](/overview/north-star/#roots). The original text is still being tracked down.

## Inkboard and Pedro

A 2004 project to turn Inkscape into a shared whiteboard. It sent changes to Inkscape's XML document over a custom Jabber namespace to other Inkscape instances. It lived in a branch, was disabled in Inkscape 0.47 because it was broken, and never synchronised `defs` or metadata.

Bob Jamison, who wrote Pedro (the XMPP library Inkboard used), later said he had misconceptions about XMPP as an XML transport. He had ideas for carrying an XML fragment without damaging it in transit, and favoured decoupling the XMPP agent from Inkscape.

**Lessons:** use your own namespace and a transit-safe encoding; keep XMPP outside Inkscape's internals; don't let a fork rot.

- [Inkscape wiki: WhiteBoard](https://wiki.inkscape.org/wiki/WhiteBoard)
- [Inkboard design document](https://inkboard.sourceforge.net/docs/DesignDocument.html)
- [Bob Jamison on Pedro 2 (inkscape-devel)](https://lists.inkscape.org/hyperkitty/list/inkscape-devel@lists.inkscape.org/message/HZWTNWGKNNPT5WX72ZQXRJQKQ3LBPOHQ)

## XEP-0284: Shared XML Editing (SXE)

An XMPP extension for synchronising XML documents between clients. To review in detail before fixing the patch envelope.

## Conversations

The Android XMPP client at conversations.im. Its model shapes XTXP: federated identity, rooms with presence, rich media and end-to-end encryption in the chat stream, and the extensions that make mobile XMPP reliable on bad connections (stream management, archive, client state, push).

## Yjs, Yrs and Loro

- **Yjs** and its Rust port **Yrs** implement YATA, including XML element and fragment types. They have no native tree move. Yrs is XTXP's [test oracle](/build/verification/).
- **Loro** (Rust) ships a movable tree CRDT natively.

## Research

- Nicolaescu et al., *Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types* (2016). The YATA paper.
- Kleppmann, Mulligan, Gomes and Beresford, *A highly-available move operation for replicated trees* (2021). The basis for Xmesh moves.

## Web overlays

- **Hypothesis `via`** proxies any page to add an annotation layer. A working model for overlays done responsibly.
- **Genius Web Annotator** overlaid annotations on other people's sites and drew sustained criticism from site owners about consent. A cautionary tale for live web branching.

## Standards

- RFC 5261: XML Patch operations
- RFC 7351: the `application/xml-patch+xml` media type
- RFC 5122: `xmpp:` URIs
- XEP-0045 (Multi-User Chat), XEP-0198 (Stream Management), XEP-0313 (Message Archive Management), XEP-0352 (Client State Indication), XEP-0357 (Push Notifications), XEP-0308 (Last Message Correction)
