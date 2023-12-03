import { copyFile, writeFile } from 'fs/promises'
import { createContext } from 'esbuild-multicontext'
import { nodeExternals } from 'esbuild-plugin-node-externals'
import { spawn } from 'child_process'

const isDev = process.argv.includes('--dev')

const buildContext = createContext()

buildContext.add('server', {
  platform: 'node',
  target: 'node14',
  entryPoints: ['./server/server.js'],
  outdir: './dist/server',
  format: 'cjs',
  plugins: [nodeExternals()],
})

// Client
buildContext.add('client', {
  platform: 'browser',
  bundle: true,
  entryPoints: ['./client/entry.js'],
  outdir: './dist/client',
  format: 'esm',
})

let spawnedTask

buildContext.hook('server:complete', () => {
  if (!isDev) return

  if (spawnedTask) {
    process.kill(spawnedTask)
  }
  const task = spawn('node', ['./dist/server/server.js'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  spawnedTask = task.pid
})

buildContext.hook('error', errors => {
  errors.map(x => process.stdout.write(x.reason.toString() + '\n'))
})

buildContext.hook('complete', async () => {
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
