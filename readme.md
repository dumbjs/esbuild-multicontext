# esbuild-multicontext

[![ComVer](https://img.shields.io/badge/ComVer-compliant-brightgreen.svg?&display_name=tag&style=flat&colorA=181819&colorB=181819)](https://gitlab.com/staltz/comver#compatible-versioning-specification-comver)

- [esbuild-multicontext](#esbuild-multicontext)
  - [What and Why?](#what-and-why)
  - [Usage](#usage)
    - [Recommended: `createContainer`](#recommended-createcontainer)
    - [Deprecated: `createContext`](#deprecated-createcontext)
  - [License](#license)



Minimal wrapper over esbuild's context API

## What and Why?

When working with modern codebases, there's always more than one esbuild config in place for either bundling server separately or the client separately and managing multiple esbuild instances isn't recommended. `esbuild` provides a `context` API for long-running esbuild tasks like watching and serving client bundles. This package wraps the context API with a very tiny wrapper to make it easier to write build tooling scripts without having to manage esbuild instances.

## Usage


### Recommended: `createContainer`

The `createContainer` API is the recommended way to manage multiple esbuild contexts.

```js
import { createContainer } from 'esbuild-multicontext'

const container = createContainer()

// Create a context with a specific configuration
container.createContext('esm', {
  entryPoints: ['./src/index.js'],
  outdir: './dist/esm',
  format: 'esm',
  outExtension: {
    '.js': '.mjs',
  },
})

// Build all contexts
const buildResults = await container.build()
console.log(buildResults)

// Run in development mode with file watching
const devOptions = {
  dirs: ['src'],
  ignored: (filepath) => false,
  watchOptions: {
    shouldRebuild: (event, filepath) => true,
    chokidar: {},
  },
  onBuild: (result, triggeredBy) => {
    console.log('Build completed', result, triggeredBy)
  },
}

const { close } = await container.dev(devOptions)

// Close the watcher when done
await close()
```

### Deprecated: `createContext`

The `createContext` API is deprecated and will be removed in future versions. Please use the `createContainer` API instead.

```js
import { createContext, CONSTANTS } from 'esbuild-multicontext'

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

buildContext.hook(CONSTANTS.ERROR, async error => {
  // multi context build failed
})

buildContext.hook(CONSTANTS.BUILD_COMPLETE, async error => {
  // Overall build complete
})

buildContext.hook(CONSTANTS.BUILD_ERROR, async error => {
  // Overall build error
})

buildContext.hook(CONSTANTS.WATCH_COMPLETE, async error => {
  // Overall watch complete
})

buildContext.hook(CONSTANTS.WATCH_ERROR, async error => {
  // Overall watch error
})

// Watch each context and re-build on change
await buildContext.watch()

// Build each context and notify the respective hooks
await buildContext.build()
```


## License

[MIT](/LICENSE)
