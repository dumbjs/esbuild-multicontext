import { writeFile } from 'fs/promises'
import fs from 'node:fs'
import glob from 'tiny-glob'
import { CONSTANTS, createContext } from './src/index.ts'
import tsc from 'tsc-prog'
import { join } from 'path'

const isDev = process.argv.includes('--dev')

const common = {
  external: ['tiny-glob', 'defu', 'esbuild', 'chokidar'],
  entryPoints: ['./src/index.js', './src/watcher.js'],
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
      outDir: './dist/esm',
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

  tsc.build({
    basePath: process.cwd(),
    compilerOptions: {
      rootDir: 'src',
      outDir: './dist/cjs',
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
  await typeGen()

  process.stdout.write('[custom-builder] Done\n')

  if (isDev) return

  process.exit(0)
})

async function typeGen() {
  const typeFolders = [
    {
      type: 'cjs',
      folder: './dist/cjs',
    },
    {
      type: 'esm',
      folder: './dist/esm',
    },
  ]
  for (let tfolder of typeFolders) {
    const filesToRename = await glob('**/*.d.ts', {
      cwd: tfolder.folder,
      filesOnly: true,
    })
    let sourceAndDist = filesToRename.map(d => {
      const src = join(tfolder.folder, d)
      const dist = join(
        tfolder.folder,
        d.replace(/\.d\.ts$/, tfolder.type === 'cjs' ? '.d.cts' : '.d.mts')
      )
      return {
        src,
        dist,
      }
    })

    for (let { src, dist } of sourceAndDist) {
      await fs.promises.cp(src, dist, { recursive: true })
      await fs.promises.rm(src)
    }
  }
}

if (isDev) await buildContext.watch()
await buildContext.build()
