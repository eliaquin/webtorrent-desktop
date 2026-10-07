const { BlockList } = require('net')
const ipaddr = require('ipaddr.js')

function address (value) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('Invalid numeric IPv4 address')
    value = [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.')
  }
  if (typeof value !== 'string') throw new Error('Invalid IP address')
  const parsed = ipaddr.process(value)
  return { value: parsed.toString(), type: parsed.kind() }
}

module.exports = class IPSet {
  constructor (blocks = []) {
    this.blocklist = new BlockList()
    for (const block of blocks) this.add(block)
  }

  add (start, end) {
    if (start && typeof start === 'object') { end = start.end; start = start.start }
    if (typeof start === 'string' && start.includes('/')) {
      const [parsed, prefix] = ipaddr.parseCIDR(start)
      this.blocklist.addSubnet(parsed.toString(), prefix, parsed.kind())
    } else {
      const first = address(start)
      if (end === undefined || end === null) this.blocklist.addAddress(first.value, first.type)
      else {
        const last = address(end)
        if (first.type !== last.type) throw new Error('IP range address families differ')
        this.blocklist.addRange(first.value, last.value, first.type)
      }
    }
  }

  contains (value) {
    try {
      const parsed = address(value)
      return this.blocklist.check(parsed.value, parsed.type)
    } catch (_) { return false }
  }
}
