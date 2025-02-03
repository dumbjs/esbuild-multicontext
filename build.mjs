#!/usr/bin/env node
// SPDX-License-Identifier: MIT

// MIT License
// Copyright (c) 2024 reaper <ahoy@barelyhuman.dev>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/**
 * Simple script to bundle and
 * emit types
 * @module
 */

import { createContainer } from './src/index.ts'
import { analyzeMetafile } from 'esbuild'
import fs from 'node:fs'
import path, { basename, dirname, join } from 'node:path'
import { rollup } from 'rollup'
import { dts } from 'rollup-plugin-dts'
import ts from 'typescript'
import k from 'kleur'
const ctxContainer = createContainer()

ctxContainer.createContext('esm', {
  entryPoints: ['src/index.ts'],
  format: 'esm',
  bundle: true,
  platform: 'node',
  metafile: true,
  logLevel: 'info',
  external: ['esbuild', 'chokidar'],
  outExtension: {
    '.js': '.mjs',
  },
  outdir: './dist/esm',
})

ctxContainer.createContext('cjs', {
  entryPoints: ['src/index.ts'],
  format: 'cjs',
  bundle: true,
  metafile: true,
  external: ['esbuild', 'chokidar'],
  platform: 'node',
  logLevel: 'info',
  outExtension: {
    '.js': '.cjs',
  },
  outdir: './dist/cjs',
})
const tmpDir = './.tmp-build'

if (process.argv.slice(2).includes('--dev')) {
  await ctxContainer.dev({
    dirs: ['./src'],
    async onBuild(result, triggeredBy) {
      if (!triggeredBy) {
        console.log(k.cyan('Initial Build'))
      } else {
        console.log(`${triggeredBy.eventLabel}: ${k.cyan(triggeredBy.file)}`)
        console.log(k.dim(`Building...`))
      }
      for (let ctxName in result) {
        console.log(`Building context ${k.cyan(ctxName)}`)
        console.log(k.dim(await analyzeMetafile(result[ctxName].metafile)))
      }
    },
  })
} else {
  const result = await ctxContainer.build()
  for (let ctxName in result) {
    console.log(`Building context ${k.cyan(ctxName)}`)
    console.log(k.dim(await analyzeMetafile(result[ctxName].metafile)))
  }
  generateTypes({
    buildConfig: {
      input: ['src/index.ts'],
      tsconfig: './tsconfig.json',
      tmpDir: tmpDir,
      outdir: './dist',
    },
  })
  await bundleTypes({
    buildConfig: {
      input: ['src/index.ts'],
      tsconfig: './tsconfig.json',
      tmpDir: tmpDir,
      outdir: './dist',
    },
  })
  fs.rmSync(tmpDir, { recursive: true })
}

function generateTypes({ buildConfig } = {}) {
  const createdFiles = {}
  const baseConfig = {
    allowJs: true,
    declaration: true,
    emitDeclarationOnly: true,
  }

  const tsconfigExists = buildConfig.tsconfig
    ? fs.existsSync(buildConfig.tsconfig)
    : false

  const includeDirs = buildConfig.input
    .map(d => d.split(path.sep)[0])
    .map(d => `${d}/**/*`)

  let tsconfigRaw = {
    compilerOptions: {
      target: 'esnext',
      module: 'esnext',
    },
    include: includeDirs,
    exclude: ['node_modules/*'],
  }

  if (tsconfigExists) {
    tsconfigRaw = JSON.parse(fs.readFileSync(buildConfig.tsconfig, 'utf-8'))
  }

  const host = ts.createCompilerHost(ts.getDefaultCompilerOptions())
  const tsOptions = ts.parseJsonConfigFileContent(
    {
      ...tsconfigRaw,
      compilerOptions: {
        ...tsconfigRaw.compilerOptions,
        ...baseConfig,
        noEmit: false,
      },
    },
    host,
    '.',
    ts.getDefaultCompilerOptions()
  )

  if (tsOptions.errors.length) {
    console.error(tsOptions.errors)
    return
  }

  const fileNames = Array.from(
    tsOptions.fileNames.concat(buildConfig.input).reduce((acc, item) => {
      if (acc.has(item)) return acc
      acc.add(item)
      return acc
    }, new Set())
  )

  host.writeFile = (fileName, contents) => (createdFiles[fileName] = contents)
  const program = ts.createProgram(fileNames, tsOptions.options, host)
  program.emit()

  fs.mkdirSync(buildConfig.tmpDir, { recursive: true })
  fileNames.forEach(file => {
    const dts = getDTSName(file)

    const fileKeyPath = Object.keys(createdFiles)
      .map(k => {
        return {
          rel: path.relative(process.cwd(), k),
          original: k,
        }
      })
      .find(obj => {
        return obj.rel === dts
      })

    const contents = createdFiles[fileKeyPath.original]
    if (!contents) {
      console.warn(`nothing to emit for file ${file}`)
      return
    }

    const destDir = join(buildConfig.tmpDir, dirname(fileKeyPath.rel))
    const destFile = join(buildConfig.tmpDir, fileKeyPath.rel)

    fs.mkdirSync(destDir, { recursive: true })
    fs.writeFileSync(destFile, createdFiles[fileKeyPath.original], 'utf8')
  })
}

async function bundleTypes({ buildConfig }) {
  await Promise.all(
    buildConfig.input.map(async entryPoint => {
      const entryName = getDTSName(entryPoint)
      const bareName = basename(entryPoint).replace(
        path.extname(entryPoint),
        ''
      )
      const entryPath = join(buildConfig.tmpDir, entryName)
      const rollupBundle = await rollup({
        input: entryPath,
        plugins: [dts()],
      })
      await rollupBundle.write({
        file: join(buildConfig.outdir, `esm/${bareName}.d.mts`),
        format: 'es',
      })
      await rollupBundle.write({
        file: join(buildConfig.outdir, `cjs/${bareName}.d.cts`),
        format: 'cjs',
      })
      await rollupBundle.close()
    })
  )
}

function getDTSName(filename) {
  return filename.replace(/(\.(js|ts))$/, '.d.ts')
}
