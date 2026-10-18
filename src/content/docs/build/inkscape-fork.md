---
title: The Inkscape fork
description: Why XTXP uses a maintained Inkscape fork, and the rules that keep it from going the way of Inkboard.
---

<span class="status status--decided">decided</span>

Inkscape's mainstream extension system runs scripts per action, with no live access to the document. A native peer needs to observe every change to the document's XML as it happens, so XTXP uses a **maintained fork** of Inkscape.

## Where edits are captured

Inkscape already groups every user action into a transaction of XML change events and commits it as one undo step ([prior art](/discussion/prior-art/#inkscapes-undo-stack)). The fork's `muppet` adapter hooks that commit, so each Inkscape action becomes one batch of XTXP operations, with the same grouping as Inkscape's own undo. Incoming operations are applied to the XML tree outside the local undo stack, so Ctrl+Z only ever undoes the user's own actions.

## The adapter contract

<span class="status status--decided">decided</span> ([decision 23](/discussion/decisions/#23-the-m2-contracts-inkscape-no-js-editing-rendering-safety))

- **Node mapping.** A side table inside the adapter maps Xmesh node IDs to Inkscape's XML nodes. Nothing extra is written into the document.
- **No echoes.** A flag stays set while remote edits are applied, so they aren't captured again as local edits.
- **Undo and other shared-whiteboard behaviour start from Inkboard.** XTXP in Inkscape is a shared whiteboard, and Inkboard thought its semantics through. Lean on them for a working first implementation, then deliberate, with [tldraw and Miro](/discussion/prior-art/#tldraw-and-miro) as modern prior art.
- **The document is exactly your version.** The adapter never rewrites `id`s. If two sessions each create the same `id`, say `path123`, merging them still converges, but leaves a [duplicate id](/spec/sessions/#conflicts-above-the-crdt) to resolve.
- **Every node kind maps.** Comments, processing instructions and CDATA are [node kinds](/spec/math/#data-model) like elements and text, so Inkscape-to-Inkscape sessions carry the XML in full. The adapter warns only if Inkscape writes something that isn't well-formed XML.

## The Inkboard warning

Inkboard, the earlier attempt to sync Inkscape over XMPP, also lived in a branch. It was disabled in Inkscape 0.47 because it was broken. See [prior art](/discussion/prior-art/#inkboard-and-pedro).

## Start from Inkboard's code

Before writing the Inkscape adapter, read Inkboard's implementation. It solved many of the same problems inside Inkscape, and reading it first saves rediscovering them:

- **Where it lives:** `src/jabber_whiteboard/` (Inkboard) and `src/pedro/` (its XMPP library) in Inkscape's 0.46 release branch. David Yip's initial commit (August 2005) went into `src/jabber_whiteboard`, behind `--enable-inkboard`, with a "Whiteboard" menu and a debug "Dump XML tracker" item.
- **What to take from it:** how it observed changes to Inkscape's XML tree, how it applied remote changes, and how it kept track of elements across peers (its "XML tracker").
- **What to test for, from its known problems:** elements Inkscape names automatically (gradient and pattern fills broke its session files), `defs` and metadata that never synced, and crashes when sessions opened in new windows.
- **What to leave behind:** the XMPP transport (now a [bridge](/spec/wire/#the-xmpp-bridge)) and the custom wire format (now Yrs updates).

Inkboard is GPL, like Inkscape, so its code can be reused inside the fork. Keep it out of the Xmesh repository unless that repository is GPL too.

- [Inkscape 0.46 source tree (Bazaar)](https://bazaar.launchpad.net/~inkscape.dev/inkscape/RELEASE_0_46_BRANCH/files/13676/src)
- [Initial commit of Inkboard code (inkscape-devel, 2005)](https://lists.inkscape.org/hyperkitty/list/inkscape-devel@lists.inkscape.org/thread/PBKG5RKK2ZBMRBHLEKMRQB63CZTQFZZZ/)
- [Inkboard software manual (PDF)](https://inkboard.sourceforge.net/docs/SoftwareManual.pdf)

## Rules for the fork

1. **The engine and the transport adapter live in their own repository** (`xtxp-link/xtxp-rs`, with the fork in `xtxp-link/inkscape`). The fork vendors them as a submodule and links Xmesh through its C interface, so Inkscape-specific code stays a thin adapter. The fork's build needs a Rust toolchain for this.
2. **CI rebases the fork onto Inkscape's main branch on a schedule.** Breakage shows up within days, not at the next release.
3. **The size of the fork's diff is a tracked metric.** If it stays small, an upstream proposal becomes realistic later.
