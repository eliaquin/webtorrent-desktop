// Controllers own the writable state; views subscribe to the branches they use.
// Notifications are batched so one action produces one React update per scope.
function createStore (initial) {
  const proxies = new WeakMap()
  const listeners = new Set()
  const versions = new Map()
  const pending = new Set()
  let revision = 0
  let scheduled = false
  const overlaps = (a, b) => a === b || a.startsWith(b + '.') || b.startsWith(a + '.')

  function changed (key) {
    key = key.split('.').slice(0, 2).join('.')
    versions.set(key, ++revision)
    pending.add(key)
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      const keys = Array.from(pending)
      pending.clear()
      for (const subscription of listeners) {
        if (keys.some(key => subscription.keys.some(scope => overlaps(key, scope)))) subscription.listener()
      }
    })
  }

  function observe (value, prefix = '') {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || value instanceof Error) return value
    if (proxies.has(value)) return proxies.get(value)
    const proxy = new Proxy(value, {
      get (target, key, receiver) {
        const value = Reflect.get(target, key, receiver)
        return typeof key === 'string' ? observe(value, prefix ? prefix + '.' + key : key) : value
      },
      set (target, key, value) {
        if (Object.is(target[key], value)) return true
        Reflect.set(target, key, value)
        changed(prefix ? prefix + '.' + String(key) : String(key))
        return true
      },
      deleteProperty (target, key) {
        if (!(key in target)) return true
        Reflect.deleteProperty(target, key)
        changed(prefix ? prefix + '.' + String(key) : String(key))
        return true
      }
    })
    proxies.set(value, proxy)
    proxies.set(proxy, proxy)
    return proxy
  }

  return {
    state: observe(initial),
    subscribe (keys, listener) {
      const subscription = { keys, listener }
      listeners.add(subscription)
      return () => listeners.delete(subscription)
    },
    version (keys) {
      let current = 0
      for (const [key, version] of versions) {
        if (keys.some(scope => overlaps(key, scope))) current = Math.max(current, version)
      }
      return current
    }
  }
}

module.exports = { createStore }
