---
title: Names and marks
description: The words XTXP uses for its parts, how to write each one, and the trademark checks behind them, including why muppet is always lowercase.
---

XTXP has a small vocabulary, and each word names one part of the design. This page says how to write them, so the spec, the code and anything said about the project stay consistent.

## The words

| Word | Names | Write it |
| --- | --- | --- |
| **XTXP** | The protocol: XML to XML Protocol, node to node | All capitals in prose. `xtxp` in code, package names and the `xtxp://` scheme. |
| **xtxp.link** | The spec site, and later a `muppet` disco | Always lowercase, as a domain. |
| **Xmesh** | The engine: the XML tree CRDT, a pure Rust layer on Yrs | Capital X, lowercase mesh. `xmesh` in code. |
| **`muppet`** | The executor and application layer: Multi User Progressive Patch Execution Tree. Client-side Xmesh, and, run headless, a session host | Always lowercase, always as code: `` `muppet` ``, `` `muppet`s ``. Never capitalised, not even at the start of a sentence; rephrase instead. |
| **session** | A line of a document's history, from one user's scratch state to `@main` | Lowercase, an ordinary word. |
| **`muppet` disco** | Discovery: finding the `muppet`s that host a session. A future milestone | Lowercase. |
| **bouncer** | A domain owner's control of its `@origin` at a disco | Lowercase, an ordinary word. |

`muppet` is written as a keyword, not a name. That's deliberate: see [the `muppet` advisory](#the-muppet-advisory) below.

### Where code style can't go

Page titles, sidebar labels, diagram labels, image alt text and HTML attributes can't hold inline code. There, write plain lowercase `muppet`, never `MUPPET` or `Muppet`.

## Name checks

| Name | Clash found | Standing |
| --- | --- | --- |
| **XTXP** | None found | Public name of the protocol and the project. |
| **Xmesh** | Thinkbox XMesh, a commercial mesh-caching plugin for VFX tools | Fine as the engine's name inside the spec. A public-facing engine name is [still open](/discussion/open-questions/#naming). |
| **`muppet`** | The Muppets, a Henson/Disney trademark | Kept as a lowercase technical keyword. See below. |

## The `muppet` advisory

*Recorded 18 October 2026. This is a summary of an informal review, not legal advice. Before any commercial launch, run a proper clearance search with an IP attorney.*

### What was asked

Would Disney act against `muppet` on xtxp.link? An AI search summary was asked, then its answer was reviewed.

### What the summary said

- **Risk is high** where the word is used commercially, could make users think Disney or the Muppets are involved, or sits next to content that could tarnish a family brand.
- **Risk is middling** for free software or open-source tools carrying the name, because software is a field the owner could plausibly license into.
- **Risk is low** for internal codenames that users never see, and for genuine commentary about the characters.
- Given that `muppet` is an acronym for a technical mechanism inside a protocol, the risk was judged **very low**, on conditions:
  - no puppet, frog or felt imagery anywhere near it;
  - lowercase or stylised in docs and code, with the expansion given where it's introduced;
  - never the product's main name or part of the domain.
- Its rule of thumb: a large rights holder can make a small project spend heavily on defence even when the project is in the right.

### What the review added

- **Confusion isn't the only test.** A famous mark can also be protected against dilution, without anyone being confused. South Africa's Trade Marks Act (section 34(1)(c)) has such a provision, as do US and EU law. "A different industry" isn't a complete answer.
- **The backronym helps, but isn't a shield.** It shows good faith. What counts is how the word is actually presented to people.
- **The claim about crawlers filing takedowns on sight of frog imagery is unsupported.** Keep the guidance (no puppet imagery), drop the certainty.
- **`muppet` is more public than an internal codename.** In this design people run, host and talk about `muppet`s, which makes it closer to a product word in software.
- **"`muppet` disco" is the riskiest phrase.** It's playful and character-flavoured, which reads more like a nod to the brand than a technical acronym.
- **Renaming gets more expensive with time.** Today a rename is a find-and-replace. Once federated nodes run other people's `muppet`s, it's a migration of a protocol nobody fully controls.

### The decision

- **`muppet` stays, as a lowercase keyword.** Always lowercase, set as code in prose, with its expansion where it's introduced. Never `MUPPET` or `Muppet`. This follows the advisory's main condition and keeps it reading as a term in the protocol, not a brand.
- **XTXP is the public name.** `muppet` never becomes the name of the product, an app-store listing or a domain.
- **No puppet imagery.** The brand is the [XTXP logo](/brand/logo/): black, white and one red. Nothing felt, furry, frog-like or puppet-like goes near `muppet`, in the UI, the logo, the docs or talks.
- **Revisit before anything commercial**, before a downloadable client ships under its own name, and before the `muppet` disco goes live. Each of those raises the stakes, the disco most of all. A clearance search (CIPC in South Africa, USPTO in the US) for the word in software classes is the first step then.
