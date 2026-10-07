module.exports = function lazy (factory) {
  let initialized = false
  let value
  return () => {
    if (!initialized) { value = factory(); initialized = true }
    return value
  }
}
