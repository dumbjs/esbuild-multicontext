import { writeFile } from 'fs/promises'
import { CONSTANTS, createContext } from './src/index.ts'
import tsc from 'tsc-prog'

const isDev = process.argv.includes('--dev')

const common = {
  external: ['tiny-glob', 'defu', 'esbuild'],
  entryPoints: ['./src/index.js'],
  platform: 'node',
  target: 'node14',
  format: 'esm',
  bundle: true,
}

const buildContext = createContext()

buildContext.add('esm', {
  ...common,
  outdir: './dist/esm',
  format: 'esm',
  outExtension: {
    '.js': '.mjs',
  },
})

buildContext.add('cjs', {
  ...common,
  outdir: './dist/cjs',
  format: 'cjs',
  outExtension: {
    '.js': '.js',
  },
})

buildContext.hook('esm:complete', async () => {
  await writeFile(
    './dist/esm/package.json',
    JSON.stringify({ type: 'module' }),
    'utf8'
  )

  process.stdout.write('[custom-builder] ESM Built\n')
})

buildContext.hook('cjs:complete', async () => {
  await writeFile(
    './dist/cjs/package.json',
    JSON.stringify({ type: 'commonjs' }),
    'utf8'
  )

  process.stdout.write('[custom-builder] CJS Built\n')
})

buildContext.hook('esm:error', async errors => {
  process.stdout.write('[custom-builder] ESM Error:\n')
  errors.map(x => console.error(x))
})

buildContext.hook('cjs:error', async errors => {
  process.stdout.write('[custom-builder] CJS Error:\n')
  errors.map(x => console.error(x))
})

buildContext.hook(CONSTANTS.BUILD_ERROR, async error => {
  console.error(error)
})

buildContext.hook(CONSTANTS.BUILD_COMPLETE, async () => {
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

  process.stdout.write('[custom-builder] Done\n')

  if (isDev) return

  process.exit(0)
})

if (isDev) await buildContext.watch()
await buildContext.build()
