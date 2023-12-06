import { spawn } from 'child_process'
import { CONSTANTS, createContext } from 'esbuild-multicontext'
import { nodeExternals } from 'esbuild-plugin-node-externals'
import { copyFile } from 'fs/promises'

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

buildContext.hook('client:complete', () => {
  console.log('Client: Built')
})

buildContext.hook('server:complete', () => {
  console.log('Server: Built')
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

buildContext.hook(CONSTANTS.ERROR, errors => {
  errors.map(x => process.stdout.write(x.reason.toString() + '\n'))
})

buildContext.hook(CONSTANTS.COMPLETE, async () => {
  process.stdout.write('[custom-builder] Built\n')

  // Copy assets after build is complete
  await copyFile('./client/index.html', './dist/client/index.html')

  if (isDev) return
  process.exit(0)
})

if (isDev) await buildContext.watch()

await buildContext.build()
