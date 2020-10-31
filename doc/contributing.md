
# Contributing

### Generating compile_commands.json

The compile_commands_json file is used by editors and language servers to provide autocompletion.

```
npx node-pre-gyp configure --debug -- -f gyp.generator.compile_commands_json.py && mv Debug/compile_commands.json . && rm Debug Release 
```

## Maintainers

This section is for maintainers.

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
