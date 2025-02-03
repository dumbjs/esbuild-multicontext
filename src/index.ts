import esbuild from 'esbuild'
import { ContextManager } from './lib/ContextManager.js'
export { CONSTANTS } from './lib/ContextManager.js'

import { Container } from './container.js'

export * from './container.js'

/**
 * @deprecated use `createContainer` API instead
 */
export function createContext(initial: esbuild.BuildOptions) {
  return new ContextManager(initial)
}

export function createContainer() {
  return new Container()
}
