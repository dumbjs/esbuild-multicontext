export const createHook = () => {
  let hookContext = new Map()
  return {
    async emit(eventName, reference: unknown) {
      const hooks = hookContext.get(eventName) || []
      for (let hook of hooks) {
        await hook(reference)
      }
    },
    hook(eventName, handler) {
      const hooks = hookContext.get(eventName) || []
      hooks.push(handler)
      hookContext.set(eventName, hooks)
      return () => {
        let _hooks = hookContext.get(eventName) || []
        _hooks.filter(x => x != handler)
        hookContext.set(eventName, _hooks)
      }
    },
  }
}
