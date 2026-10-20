# Design: separate the muppet from the applications that drive it

Date: 2026-10-20. Status: done in `xtxp-rs` on branch `m2-y-sweet-browser`; spec in [decision 27](https://xtxp.link/discussion/decisions/#27-a-muppet-executes-applications-drive-it).

## Why

The `xtxp-muppet` crate bundled the muppet function (sync, tree, ops) with three applications: the terminal UI, `serve` (the browser view) and the one-shot commands. A physics engine that owns a space was about to be a fourth. The spec says a muppet executes and applications own the views, so the code was split to match.

## The boundary

Applications embed the muppet as an in-process library. There is no new daemon or protocol, and each application is its own binary. The boundary was already narrow, and this work documents and enforces it:

- **In:** `core::Command`, sent on an unbounded channel. Edits are aimed at nodes, not paths.
- **Out:** a `ports::View` the application implements, receiving `Screen` (the tree with node IDs, what changed, hashes, connection state), a status line and a final `Outcome`.
- **Entry point:** `adapters::ws::run(mode, server, doc, view, commands)`. It builds its own runtime, so an application calls it from a plain `main` and runs anything else on another thread.

One view and one command channel belong to one muppet. Several applications working on a session each run their own muppet.

## Layout

| Crate | Binary | Role |
| --- | --- | --- |
| `xtxp-muppet` | `xtxp-muppet` | Core, ports, ws and y-sweet adapters, and the one-shot commands `init`, `edit`, `show`, `replay`. |
| `xtxp-tui` | `xtxp-tui <doc> [--read-only] [--server]` | Terminal editor. |
| `xtxp-serve` | `xtxp-serve <doc> [--listen] [--server]` | Browser renderer in three delivery modes, with its renderer module. |
| `xtxp-orbit` | `xtxp-orbit <doc> [--server] ...` | Three-body physics engine; see below. |

Names carry no language suffix: the repository `xtxp-rs` is the Rust implementation's namespace. Muppets in other languages are separate implementations of the same spec with their own applications. `--server` and its default stay on every application, and document names are validated by one shared function.

## xtxp-orbit

The first engine. The cross and the two outer X's of the logo are bodies under mutual softened gravity, integrated with velocity-Verlet at a fixed timestep (240 Hz by default) through an accumulator, so the simulation is identical however often it is sampled. Each body also spins about its own centre at a constant rate. A separate publish loop (30 Hz by default) samples interpolated poses and sends one `set-attr transform` per body: `translate(x y) rotate(a)` followed by whatever the document already had after its `translate`, so the cross keeps `rotate(45) scale(.606)`. Parts are found by the logo's `xl-l`, `xl-c` and `xl-r` classes, and orbit's own rotation is recognisable on reading, so restarting on a moved document does not compound it. Defaults are a circular orbit about the cross, one X moving up and one down, in the logo's own units.

## Not built

- The engine's step takes no inputs yet. Merging several people's layers and rubber-banding are [open question Q10](https://xtxp.link/discussion/open-questions/).
- Restoring the document when orbit exits.
- Where Inkscape's adapter and a browser's Wasm muppet sit in this split is not settled; the spec pages say so.

## Verification

`cargo fmt`, `clippy -D warnings` and the workspace tests are unchanged in count by the move (per-file counts match the commit before it), plus 12 orbit tests. The y-sweet end-to-end tests, the `bench-browser` smoke test and a run of `xtxp-serve` with `xtxp-orbit` against a real y-sweet pass. The Playwright suite runs in CI.
