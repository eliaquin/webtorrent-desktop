// Read transfer items during the drop event, before the browser protects them.
module.exports = function attachDropHandler (target, { onDrop, onDropText, onError = console.error }) {
  const element = typeof target === 'string' ? document.querySelector(target) : target
  if (!element) throw new Error('Drop target not found')
  let depth = 0
  let active = true
  function reset () {
    depth = 0
    element.classList.remove('drag')
  }
  function handle (event) {
    const transfer = event.dataTransfer
    if (!transfer) return
    const fileDrop = Array.from(transfer.types || []).includes('Files') || transfer.files?.length > 0
    // Preserve text editing, but prevent dropped files from navigating the app.
    if (!fileDrop && event.target.closest?.('input, textarea, [contenteditable="true"]')) return
    event.preventDefault()
    event.stopPropagation()
    if (event.type === 'dragenter') {
      depth++
      element.classList.add('drag')
    } else if (event.type === 'dragleave') {
      depth = Math.max(0, depth - 1)
      if (depth === 0) reset()
    } else if (event.type === 'dragover') {
      transfer.dropEffect = 'copy'
    } else {
      reset()
      try {
        const items = Array.from(transfer.items || []).filter(item => item.kind === 'file')
        const entries = items.map(item => ({ entry: item.webkitGetAsEntry?.(), file: item.getAsFile() }))
        const files = Array.from(transfer.files || [])
        if (entries.length || files.length) {
          collectFiles(entries, files).then(result => {
            if (active && result.length) onDrop(result)
          }).catch(error => { if (active) onError(error) })
        } else {
          const uri = transfer.getData('text/uri-list').split(/\r?\n/).find(line => line.trim() && !line.startsWith('#'))
          const text = (uri || transfer.getData('text/plain')).trim()
          if (text) onDropText(text)
        }
      } catch (error) { onError(error) }
    }
  }
  const events = ['dragenter', 'dragover', 'dragleave', 'drop']
  for (const name of events) element.addEventListener(name, handle)
  return () => {
    active = false
    reset()
    for (const name of events) element.removeEventListener(name, handle)
  }
}

async function collectFiles (items, fallback) {
  if (!items.length) return fallback
  const files = []
  async function visit (entry, file, depth = 0) {
    if (depth > 128) throw new Error('Dropped folder is nested too deeply')
    if (entry?.isDirectory) {
      const reader = entry.createReader()
      while (true) {
        const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
        if (!batch.length) break
        for (const child of batch) await visit(child, null, depth + 1)
      }
    } else if (file) {
      files.push(file)
    } else if (entry?.isFile) {
      files.push(await new Promise((resolve, reject) => entry.file(resolve, reject)))
    }
  }
  for (const { entry, file } of items) await visit(entry, file)
  return files
}
