import esbuild from 'esbuild'
import { ContextManager } from './lib/ContextManager.js'
export { CONSTANTS } from './lib/ContextManager.js'

export function createContext(initial: esbuild.BuildOptions) {
  return new ContextManager(initial)
}
