import { writeFile } from 'fs/promises'
import { createContext } from './src/index.ts'
import tsc from 'tsc-prog'

const isDev = process.argv.includes('--dev')

const buildContext = createContext({
  bundle: true,
})

const common = {
  external: ['tiny-glob', 'defu', 'esbuild'],
  entryPoints: ['./src/index.js'],
  platform: 'node',
  target: 'node14',
  format: 'esm',
}

buildContext.config({
  ...common,
  outdir: './dist/esm',
  format: 'esm',
  outExtension: {
    '.js': '.mjs',
  },
})

buildContext.config({
  ...common,
  outdir: './dist/cjs',
  format: 'cjs',
  outExtension: {
    '.js': '.js',
  },
})

buildContext.on('error', errors => {
  errors.map(x => process.stdout.write(x.reason.toString() + '\n'))
})

buildContext.on('build', async () => {
  process.stdout.write('[custom-builder] Built\n')

  await writeFile(
    './dist/cjs/package.json',
    JSON.stringify({ type: 'commonjs' }),
    'utf8'
  )

  await writeFile(
    './dist/esm/package.json',
    JSON.stringify({ type: 'module' }),
    'utf8'
  )

  tsc.build({
    basePath: process.cwd(),
    compilerOptions: {
      rootDir: 'src',
      outDir: './dist/types',
      declaration: true,
      moduleResolution: 'nodenext',
      target: 'esnext',
      module: 'NodeNext',
      emitDeclarationOnly: true,
      skipLibCheck: true,
    },
    include: ['src/**/*'],
    exclude: ['**/*.test.ts', '**/*.spec.ts'],
  })

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
