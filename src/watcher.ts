import chokidar from 'chokidar'
import { existsSync } from 'node:fs'
import path from 'node:path'
import glob from 'tiny-glob'

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
  const syncify = (pattern: string, root: string, cb: () => void) => {
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

  const builder = () => context.build.bind(context)

  return (
    globPattern: string,
    { root, onEvent, onBuild }: Options = { root: '.' }
  ) => {
    syncify(globPattern, root ?? '.', () => {
      watchers.forEach(w => {
        w.addListener('all', (type, file) => {
          if (!onEvent) {
            return forcePromise(builder).then(() => {
              onBuild?.()
            })
          }
          const build = onEvent?.({
            type,
            file,
          })

          if (!build) return
          return forcePromise(builder).then(() => {
            onBuild?.()
          })
        })
      })
    })
  }
}

async function forcePromise<T, G>(fn: (...any: T[]) => G) {
  const inst = fn()
  return inst
}
