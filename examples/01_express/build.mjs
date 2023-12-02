import { copyFile, writeFile } from 'fs/promises'
import { createContext } from 'esbuild-multicontext'
import { nodeExternals } from 'esbuild-plugin-node-externals'

const isDev = process.argv.includes('--dev')

const buildContext = createContext({
  bundle: true,
})

// Server
buildContext.config({
  platform: 'node',
  target: 'node14',
  entryPoints: ['./server/server.js'],
  outdir: './dist/server',
  format: 'cjs',
  plugins: [nodeExternals()],
})

// Client
buildContext.config({
  platform: 'browser',
  bundle: true,
  entryPoints: ['./client/entry.js'],
  outdir: './dist/client',
  format: 'esm',
})

buildContext.on('error', errors => {
  errors.map(x => process.stdout.write(x.reason.toString() + '\n'))
})

buildContext.on('build', async () => {
  process.stdout.write('[custom-builder] Built\n')

  // Copy assets after build is complete
  await copyFile('./client/index.html', './dist/client/index.html')

  if (isDev) return
  process.exit(0)
})

function createChain() {
  let agg = Promise.resolve()
  const _chainer = fn => {
    agg = agg.then(fn)
  }
  _chainer.value = async () => {
    await agg
    return null
  }
  return _chainer
}

const chain = createChain()

if (isDev) {
  chain(() => buildContext.watch())
}

chain(() => buildContext.build())

await chain.value
