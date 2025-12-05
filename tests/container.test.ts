import chokidar from 'chokidar'
import * as esbuild from 'esbuild'
import { stub } from 'sinon'
import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { Container, DevOptions } from '../dist/esm/index.mjs'

// Mock esbuild
const mockEsbuild = {
  context: stub().resolves({
    rebuild: stub().resolves({}),
    dispose: stub().resolves(),
  }),
}

// Mock chokidar
const mockChokidar = {
  watch: stub().returns({
    on: stub().returnsThis(),
    close: stub().resolves(),
  }),
}

test('Container creation', () => {
  const container = new Container(mockEsbuild as unknown as typeof esbuild)
  assert.ok(container instanceof Container)
})

test('createContext method', () => {
  const container = new Container(mockEsbuild as unknown as typeof esbuild)
  const config = { entryPoints: ['src/index.ts'], outfile: 'dist/index.js' }
  container.createContext('test', config)
  assert.strictEqual(container['configs']['test'], config)
})

test('build method', async () => {
  const container = new Container(mockEsbuild as unknown as typeof esbuild)
  const config = { entryPoints: ['src/index.ts'], outfile: 'dist/index.js' }
  container.createContext('test', config)
  const result = await container.build()
  assert.ok(result['test'])
})

test('dev method', async () => {
  const container = new Container(mockEsbuild as unknown as typeof esbuild)
  const config = { entryPoints: ['src/index.ts'], outfile: 'dist/index.js' }
  container.createContext('test', config)

  const onBuild = stub()

  const devOptions: DevOptions = {
    dirs: ['src'],
    ignored: () => false,
    watchOptions: {
      shouldRebuild: () => true,
      chokidar: {},
    },
    onBuild,
  }

  const watcherStub = stub(chokidar, 'watch').returns(mockChokidar.watch())

  const { close } = await container.dev(devOptions)
  assert.ok(watcherStub.calledOnce)
  assert.ok(onBuild.calledOnce)

  await close()
  assert.ok(mockChokidar.watch().close.calledOnce)
})
