<!--
Release PR template. Use it only for release PRs from `develop` to `main`.
GitHub does not auto-select a named template: open the PR with
`?template=release.md` appended to the compare URL, for example
`https://github.com/<owner>/<repo>/compare/main...develop?expand=1&template=release.md`.
Spec: docs/spec/operations.md section 6.
-->

## Release checklist

- [ ] CI green
- [ ] `main` merged into `develop` if `main` had commits `develop` lacks (docs committed straight to `main`)
- [ ] Staging refreshed and deployed on the commit being released (`docs/runbooks/backup-and-restore.md`, "Before every release")
- [ ] Staging batch re-parse report (`docs/spec/operations.md` section 7) reviewed, if the release changes the engine or KB version
- [ ] The owner merges
