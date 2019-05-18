# Maintainers

Useful things to know for maintainers.

## Release checklist
 - Update the changelog (and decide which version component will be bumped)
 - Update the readme if needed
 - `npm version [major/minor/patch]`
 - `npm publish`
 - `git commit --allow-empty -m '[publish binary]'`
 - `git push`
