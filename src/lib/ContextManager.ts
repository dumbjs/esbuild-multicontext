import esbuild from 'esbuild'
import { defu } from 'defu'
import glob from 'tiny-glob'
import { createHook } from './hooks.js'
import { batcher } from './promise.js'

const NAME = Symbol('esb_name')

type FilePath = string

type GlobOptions = {
  cwd?: string
  dot?: boolean
  absolute?: boolean
  filesOnly?: boolean
  flush?: boolean
}

export const CONSTANTS = {
  ERROR: 'ebm:error',
  BUILD_COMPLETE: 'ebm_build:complete',
  WATCH_COMPLETE: 'ebm_watch:complete',
  BUILD_ERROR: 'ebm_build:error',
  WATCH_ERROR: 'ebm_watch:error',
}

export class ContextManager {
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

  getConfig(name: string) {
    return this.#contextConfigs.find(x => x.name === name)
  }

  getAllConfigs() {
    return this.#contextConfigs.slice()
  }

  /**
   * returns the raw esbuild context to be used
   * externally from the multicontext environment
   *
   * this will not fire any of the hooks or report rebuilds
   * please avoid using this unless you wish to manage the context
   * manually
   * @param name
   * @returns
   */
  getContext(name: string) {
    const configDefinition = this.#contextConfigs.find(x => x.name == name)
    if (!configDefinition) {
      return false
    }
    return this.#atomicCreateContext(configDefinition)
  }

  add(name: string, conf: esbuild.BuildOptions) {
    if (name === 'ebm') {
      throw new Error('`ebm` is a reserved name, please use something else')
    }
    this.#contextConfigs.push({
      name,
      config: defu(conf, this.initialConfig),
    })
  }

  glob(pattern: string, opts: GlobOptions): Promise<FilePath[]> {
    return glob(pattern, opts)
  }

  async #atomicCreateContext(config) {
    let cfg = config
    cfg.config.plugins ||= []
    const context = await esbuild.context(defu(cfg, this.initialConfig))
    return context
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

        context[NAME] = cfg.name
        this.#contexts.push(context)
      } catch (err) {
        await this.#eventBus.emit(getContextErrorName(cfg.name), [err])
        break
      }
    }
  }

  /**
   * @param {object} options
   * @param {string} options.name - experimental
   * @param {number} options.limit
   *
   * @description run a certain number of builds at once to avoid heavy usage of memory
   * esbuild itself is fast so this doesn't take much time but if there's cases where it's hanging up your system,
   * then use the `limit` option to set an execution window
   *
   * example: if limit is 1, one build is run at most at a time
   * if limit is 3, at any given time 3 builds would be running.
   *
   * **Note**: This option makes no sense unless you usecase handles over 10+ context instances
   */
  async build({ name = '', limit = Number.MAX_VALUE } = {}) {
    await this.#createContext()
    if (name && name.length > 0) {
      const baseConfig = this.#contexts.find(d => d[NAME] === name)
      await baseConfig?.rebuild()
    } else {
      const errors = await batcher(x => x.rebuild(), { limit })(this.#contexts)
      if (errors.length > 0) {
        return await this.#eventBus.emit(CONSTANTS.BUILD_ERROR, errors)
      }
      await this.#eventBus.emit(CONSTANTS.BUILD_COMPLETE, null)
    }
  }

  /**
   * @param {object} options
   * @param {number} options.limit
   *
   * @description run a certain number of watchers at once to avoid heavy usage of memory
   * esbuild itself is fast so this doesn't take much time but if there's cases where it's hanging up your system,
   * then use the `limit` option to set an execution window
   *
   * example: if limit is 1, one build is run at most at a time
   * if limit is 3, at any given time 3 watchers would be running.
   *
   * **Note**: This option makes no sense unless you usecase handles over 10+ context instances
   */
  async watch({ limit = Number.MAX_VALUE } = {}) {
    await this.#createContext()
    const errors = await batcher(x => x.watch(), { limit })(this.#contexts)
    if (errors.length > 0) {
      return await this.#eventBus.emit(CONSTANTS.WATCH_ERROR, errors)
    }
    await this.#eventBus.emit(CONSTANTS.WATCH_COMPLETE, null)
  }

  async dispose() {
    await this.#createContext()
    await batcher(x => x.dispose(), { limit: Number.MAX_VALUE })(this.#contexts)
  }
}

function generateReportingPlugin(eBus, name): esbuild.Plugin {
  return {
    name: 'esbuild-multicontext-handler',
    setup(build) {
      build.onEnd(async result => {
        if (result.errors.length > 0) {
          return await eBus.emit(getContextErrorName(name), result.errors)
        }

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
