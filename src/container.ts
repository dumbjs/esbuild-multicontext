import { context } from 'esbuild'
import esbuild from 'esbuild'
import chokidar, { ChokidarOptions } from 'chokidar'

export type Trigger = {
  event: string
  eventLabel: string
  file: string
}

export type OnBuildListener = (
  result: Record<string, esbuild.BuildResult>,
  triggeredBy?: Trigger
) => void

export type DevOptions = {
  dirs: string[]
  ignored: (filepath: string) => boolean
  watchOptions?: {
    shouldRebuild: (event: string, filepath: string) => boolean
    chokidar: Omit<ChokidarOptions, 'ignored'>
  }
  onBuild?: OnBuildListener
}

export class Container {
  private configs: Record<string, esbuild.BuildOptions> = {}

  constructor() {}

  createContext(name: string, config: esbuild.BuildOptions) {
    this.configs[name] = config
  }

  private async createNamedCtx() {
    const pendingContextCreation: Promise<{
      name: string
      ctx: esbuild.BuildContext
    }>[] = []
    for (let contextKey in this.configs) {
      pendingContextCreation.push(
        context(this.configs[contextKey]).then(d => ({
          name: contextKey,
          ctx: d,
        }))
      )
    }
    const activeContexts = await Promise.all(pendingContextCreation)
    return activeContexts
  }

  async build() {
    const activeContexts = await this.createNamedCtx()
    return Object.fromEntries(
      await Promise.all(
        activeContexts.map(async d => {
          const buildResult = await d.ctx.rebuild()
          await d.ctx.dispose()
          return [d.name, buildResult]
        })
      )
    )
  }

  /**
   * Run all the contexts in dev mode, this includes running a
   * watcher on the mentioned directories by `options.dirs`.
   *
   * There is hooks like `onBuild` and `watchOptions.shouldRebuild` that can
   * be used to control external behaviour like running a live reloaded server
   * @param {DevOptions} options
   */
  async dev(
    {
      dirs = ['.'],
      ignored = () => false,
      watchOptions,
      onBuild = () => {},
    }: DevOptions = {
      dirs: ['.'],
      ignored: () => false,
    }
  ) {
    const buildAndNotify = createBuildAndNotify(onBuild)
    const shouldRebuild = watchOptions?.shouldRebuild ?? (() => true)
    const activeContexts = await this.createNamedCtx()
    const watcher = chokidar.watch(dirs, {
      ...(watchOptions?.chokidar ?? {}),
      ignored: ignored,
      ignoreInitial: true,
    })

    watcher.on('all', async (event, file) => {
      if (!shouldRebuild(event, file)) {
        return
      }

      await buildAndNotify(activeContexts, {
        event,
        file,
      })
    })

    await buildAndNotify(activeContexts)

    return {
      close: async () => {
        await watcher.close()
        await Promise.all(activeContexts.map(d => d.ctx.dispose()))
      },
    }
  }
}

function createBuildAndNotify(onBuild?: OnBuildListener) {
  return async (
    activeContexts: {
      name: string
      ctx: esbuild.BuildContext
    }[],
    triggeredBy?: Pick<Trigger, 'event' | 'file'>
  ) => {
    const results = Object.fromEntries(
      await Promise.all(
        activeContexts.map(async d => {
          return [d.name, await d.ctx.rebuild()]
        })
      )
    )
    let _triggeredBy: Trigger | undefined
    if (triggeredBy) {
      _triggeredBy = {
        ...triggeredBy,
        eventLabel: triggeredBy.event
          .split(/\s/)
          .map(d => [d.charAt(0).toLocaleUpperCase(), d.slice(1)].join(''))
          .join(),
      }
    }
    onBuild?.(results, _triggeredBy)
  }
}
