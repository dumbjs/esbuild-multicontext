import esbuild from "esbuild";
import { defu } from "defu";
import glob from "tiny-glob";
import { EventEmitter } from "node:events";

export type GlobOptions = {
  cwd?: string;
  dot?: boolean;
  absolute?: boolean;
  filesOnly?: boolean;
  flush?: boolean;
};

export type FilePath = string;

class ContextManager {
  initialConfig: esbuild.BuildOptions = {};
  #contextConfigs: esbuild.BuildOptions[] = [];
  #contexts: esbuild.BuildContext[] = [];
  #eventBus = new EventEmitter();

  constructor(initial: esbuild.BuildOptions) {
    this.initialConfig = initial;
  }

  config(conf: esbuild.BuildOptions) {
    this.#contextConfigs.push(defu(conf, this.initialConfig));
  }

  glob(pattern: string, opts: GlobOptions): Promise<FilePath[]> {
    return glob(pattern, opts);
  }

  on(eventName: "error" | "build", listener: (...args: any[]) => void) {
    this.#eventBus.addListener(eventName, listener);
    return () => this.#eventBus.removeListener(eventName, listener);
  }

  offAll(eventName: string) {
    this.#eventBus.removeAllListeners(eventName);
  }

  async #createContext() {
    const eBus = this.#eventBus;
    let cfg;

    while ((cfg = this.#contextConfigs.shift())) {
      try {
        cfg.plugins ||= [];

        cfg.plugins.push({
          name: "esbuild-multicontext-handler",
          setup(build) {
            build.onEnd((result) => {
              eBus.emit(`built-context`, {
                result,
              });
            });
          },
        });

        const context = await esbuild.context(defu(cfg, this.initialConfig));

        this.#contexts.push(context);
      } catch (err) {
        this.#eventBus.emit("error", err);
        break;
      }
    }
  }

  async build() {
    await this.#createContext();
    this.#contexts.forEach((x) => x.rebuild());

    this.#eventBus.emit("build");
  }

  async watch() {
    await this.#createContext();
    await Promise.all(this.#contexts.map((x) => x.watch()));
  }
}

export function createContext(initial: esbuild.BuildOptions) {
  return new ContextManager(initial);
}
