import chokidar from 'chokidar'
import type { ContextManager } from './lib/ContextManager.js'
import { existsSync } from 'node:fs'
import glob from 'tiny-glob'
import path from 'node:path'

export type WatchEvent = {
  type: string
  file: string
}

export type Options = {
  root?: string
  onBuild?(): void | Promise<void>
  onEvent?(event: WatchEvent): boolean
}

export interface ContextRebuilder {
  build(...args: unknown[]): unknown | Promise<unknown>
}

export const createContextWatcher = (context: ContextRebuilder) => {
  const watchers: chokidar.FSWatcher[] = []
  const syncify = (pattern, root, cb) => {
    const _path = path.join(root, pattern)
    if (!existsSync(_path)) {
      glob(pattern, {
        filesOnly: true,
        cwd: root,
      }).then(globFiles => {
        const watcher = chokidar.watch(globFiles)
        watchers.push(watcher)
        cb()
      })
    } else {
      const watcher = chokidar.watch(pattern, { cwd: root })
      watchers.push(watcher)
      cb()
    }
  }
  return (globPattern, { root, onEvent, onBuild }: Options = { root: '.' }) => {
    syncify(globPattern, root, () => {
      watchers.forEach(w => {
        w.addListener('all', (type, file) => {
          if (!onEvent) {
            return forcePromise(context.build).then(() => {
              onBuild?.()
            })
          }
          const build = onEvent?.({
            type,
            file,
          })

          if (!build) return
          return forcePromise(context.build).then(() => {
            onBuild?.()
          })
        })
      })
    })
  }
}

async function forcePromise(fn) {
  const inst = fn()
  return inst
}
