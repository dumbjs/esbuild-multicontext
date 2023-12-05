import esbuild from 'esbuild'
import { defu } from 'defu'
import glob from 'tiny-glob'
import { createHook } from './lib/hooks.js'
import { batcher } from './lib/promise.js'

export type GlobOptions = {
  cwd?: string
  dot?: boolean
  absolute?: boolean
  filesOnly?: boolean
  flush?: boolean
}

export type FilePath = string

class ContextManager {
  initialConfig: esbuild.BuildOptions = {}
  #contextConfigs: { name: string; config: esbuild.BuildOptions }[] = []
  #contexts: esbuild.BuildContext[] = []
  #eventBus = createHook()

  constructor(initial: esbuild.BuildOptions) {
    this.initialConfig = initial
  }

  hook(eventName, handler) {
    return this.#eventBus.hook(eventName, handler)
  }

  add(name: string, conf: esbuild.BuildOptions) {
    this.#contextConfigs.push({
      name,
      config: defu(conf, this.initialConfig),
    })
  }

  glob(pattern: string, opts: GlobOptions): Promise<FilePath[]> {
    return glob(pattern, opts)
  }

  async #createContext() {
    const eBus = this.#eventBus
    let cfg

    while ((cfg = this.#contextConfigs.shift())) {
      try {
        cfg.config.plugins ||= []

        cfg.config.plugins.push(generateReportingPlugin(eBus, cfg.name))

        const context = await esbuild.context(
          defu(cfg.config, this.initialConfig)
        )

        this.#contexts.push(context)
      } catch (err) {
        await this.#eventBus.emit(getContextErrorName(cfg.name), [err])
        break
      }
    }
  }

  async build({ limit = Number.MAX_VALUE } = {}) {
    await this.#createContext()
    const errors = await batcher(x => x.rebuild(), { limit })(this.#contexts)
    if (errors.length > 0) {
      await this.#eventBus.emit('error', errors)
    } else {
      await this.#eventBus.emit('complete', null)
    }
  }

  async watch() {
    await this.#createContext()
    await Promise.all(this.#contexts.map(x => x.watch()))
  }
}

export function createContext(initial: esbuild.BuildOptions) {
  return new ContextManager(initial)
}

function generateReportingPlugin(eBus, name): esbuild.Plugin {
  return {
    name: 'esbuild-multicontext-handler',
    setup(build) {
      build.onEnd(async result => {
        if (result.errors.length > 0)
          return await eBus.emit(getContextErrorName(name), result.errors)

        await eBus.emit(getContextCompletionName(name), result)
      })
    },
  }
}

function getContextCompletionName(name) {
  return `${name}:complete`
}

function getContextErrorName(name) {
  return `${name}:error`
}
