
# Contributing

### Generating compile_commands.json

The compile_commands_json file is used by editors and language servers to provide autocompletion.

```
npx node-pre-gyp configure --debug -- -f gyp.generator.compile_commands_json.py && mv Debug/compile_commands.json . && rm Debug Release 
```

### Scripts

The `scripts` folder contains:

 - `build.sh`: build script (for travis)
 - `install_node.sh`: install node (for travis)
 - `list-available-modules.js`: list available modules from the command line (`node ./scripts/list-available-modules.js`)
 - `preinspect.js`: quickly inspect GIR metadata (`node -r ./scripts/preinspect.js`)
 - `preload.js`: quickly test Gtk/Gdk (`node -r ./scripts/preload.js`)

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
