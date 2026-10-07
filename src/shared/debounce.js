module.exports = function debounce (action, delay, leading = false) {
  let timer
  return function (...args) {
    const immediate = leading && !timer
    clearTimeout(timer)
    timer = setTimeout(() => { timer = null; if (!leading) action.apply(this, args) }, delay)
    if (immediate) action.apply(this, args)
  }
}
