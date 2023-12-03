import { writeFile } from 'fs/promises'
import { createContext } from './src/index.ts'
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
  process.stdout.write('[custom-builder] ESM Built\n')
})

buildContext.hook('cjs:complete', async () => {
  process.stdout.write('[custom-builder] CJS Built\n')
})

buildContext.hook('cjs:error', async errors => {
  process.stdout.write('[custom-builder] CJS Error:\n')
  console.error(errors)
})

buildContext.hook('error', async error => {
  console.error(error)
})

buildContext.hook('complete', async () => {
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

if (isDev) await buildContext.watch()
await buildContext.build()
