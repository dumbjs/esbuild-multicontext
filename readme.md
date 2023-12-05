# esbuild-multicontext

[![ComVer](https://img.shields.io/badge/ComVer-compliant-brightgreen.svg)](https://github.com/barelyhuman/esbuild-multicontext)

Minimal wrapper over esbuild's context API

## What and Why ?

When working with modern codebases, there's always more than one esbuild config
in place for either bundling server separately or the client separately and
managing mulitple esbuild instances isn't recommended. `esbuild` provides a
`context` API for long running esbuild tasks like watching and serving client
bundles. This package wraps the context API with a very tiny wrapper to make it
easier to write build tooling scripts without having to manage esbuild
instances.

## Usage

```js
import { createContext } from 'esbuild-multicontext'

const buildContext = createContext()

// Use the helper glob to find files and directories
const entries = await buildContext.glob('./src/*.js', {
  filesOnly: true,
})

buildContext.add('esm', {
  entryPoints: entries,
  outdir: './dist/esm',
  format: 'esm',
  outExtension: {
    '.js': '.mjs',
  },
})

buildContext.hook('esm:complete', async () => {
  // context built completely
})

buildContext.hook('esm:error', async error => {
  // context failed with `error`
})

buildContext.hook('error', async error => {
  // multi context build failed
})

// Watch each context and re-build on change
await buildContext.watch()

// Build each context and notify the respective hooks
await buildContext.build()
```

## License

[MIT](/LICENSE)
