# Finders Eaters

Early design stage: the product idea and research live in `docs/ideation/`. The route from there to a V0.1 spec is charted on the GitHub issue labelled `wayfinder:map`.

## Working rules

- **No code on `main` directly.** Docs may go straight to `main`. Code follows gitflow: feature branches off `develop`, and every release to `main` waits for the owner's review.
- **Decide what can be undone; escalate what can't.** Agents settle decisions that are easy to reverse or low impact themselves, and record them. Decisions that are hard to reverse go to the owner in a decision memo before anything acts on them.

## Agent skills

### Issue tracker

GitHub issues on this repo, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single context: `CONTEXT.md` at the root is the glossary, and ADRs go in `docs/adr/`.
