---
title: The Inkscape fork
description: Why XTXP uses a maintained Inkscape fork, and the rules that keep it from going the way of Inkboard.
---

<span class="status status--decided">decided</span>

Inkscape's mainstream extension system runs scripts per action, with no live access to the document. A native peer needs to observe every change to the document's XML as it happens, so XTXP uses a **maintained fork** of Inkscape.

## Where edits are captured

Inkscape already groups every user action into a transaction of XML change events and commits it as one undo step ([prior art](/discussion/prior-art/#inkscapes-undo-stack)). The fork's MUPPET adapter hooks that commit, so each Inkscape action becomes one batch of XTXP operations, with the same grouping as Inkscape's own undo. Incoming operations are applied to the XML tree outside the local undo stack, so Ctrl+Z only ever undoes the user's own actions.

## The Inkboard warning

Inkboard, the earlier attempt to sync Inkscape over XMPP, also lived in a branch. It was disabled in Inkscape 0.47 because it was broken. See [prior art](/discussion/prior-art/#inkboard-and-pedro).

## Rules for the fork

1. **The engine and the transport adapter live in their own repository.** The fork vendors them as a submodule and links Xmesh through its C interface, so Inkscape-specific code stays a thin adapter. The fork's build needs a Rust toolchain for this.
2. **CI rebases the fork onto Inkscape's main branch on a schedule.** Breakage shows up within days, not at the next release.
3. **The size of the fork's diff is a tracked metric.** If it stays small, an upstream proposal becomes realistic later.
