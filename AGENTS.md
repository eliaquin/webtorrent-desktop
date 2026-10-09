# Build delivery

When the user requests a new distributable build, commit and push the associated
source changes to `origin/main` so another computer can build the same version.
Check the remote branch after pushing and report its commit SHA.

This does not apply to compilation performed as part of development or tests.
Do not publish a GitHub release or upload build artifacts unless the user asks.
Keep local downloads, saved preferences, and build backups out of Git commits.
