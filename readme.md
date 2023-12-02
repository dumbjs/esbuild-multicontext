# esbuild-multicontext

Minimal wrapper over esbuild's context API


## What and Why ?

When working with modern codebases, there's always more than one esbuild config in place for either bundling server separately or the client separately and managing mulitple esbuild instances isn't recommended. `esbuild` provides a `context` API for long running esbuild tasks like watching and serving client bundles. This package wraps the context API with a very tiny wrapper to make it easier to write build tooling scripts without having to manage esbuild instances. 

## Usage 

> API Status: `unstable`

Please use the `build.js` file to get a basic idea of the current API, this will change till the library reaches `0.0.1`


## License 
[MIT](/LICENSE)