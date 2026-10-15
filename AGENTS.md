# Build delivery

When the user requests a new distributable build, commit and push the associated
source changes to `origin/main` so another computer can build the same version.
Check the remote branch after pushing and report its commit SHA.

Merging or pushing application, dependency, packaging, or release-workflow changes
to `origin/main` authorizes the existing automatic release pipeline: run CI,
increment the patch version, build and sign both Mac architectures, notarize and
verify them, upload artifacts, and publish the GitHub release. Do not ask for
additional confirmation to build, upload, or publish as part of this pipeline.
Do not add release-skip guards or bypass automatic publication unless the user
explicitly requests a build-only delivery or asks to pause publication.

Keep the existing workflow path filters: documentation-only changes do not need
a new release. Compilation performed as part of development or tests does not
by itself authorize a release or require a commit and push.
Keep local downloads, saved preferences, and build backups out of Git commits.
