# Maintainers

Useful things to know for maintainers.

## Release checklist
 - Make sure the latest master tests passed
 - Update the changelog (and decide which version component will be bumped)
 - Update the readme if needed
 - `npm version [major/minor/patch]`
 - `npm publish`
 - `git commit --allow-empty -m '[publish binary][skip tests]'` (skip tests
     because you made sure the last tests are passing)
 - `git push --tags`
 - Make sure the `[publish binary][skip tests]` build succeeds
 - Make sure the binaries have been pushed to the S3 bucket
