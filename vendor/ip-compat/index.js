const ipaddr = require('ipaddr.js')
const os = require('os')

function parse (value) {
  if (typeof value !== 'string' || !ipaddr.isValid(value)) throw new Error('Invalid IP address')
  return ipaddr.process(value)
}

function toLong (value) {
  const address = parse(value)
  if (address.kind() !== 'ipv4') throw new Error('Expected IPv4 address')
  return address.toByteArray().reduce((n, octet) => n * 256 + octet, 0)
}

function toString (buffer, offset = 0, length = buffer.length - offset) {
  if (length !== 4 && length !== 16) throw new Error('Invalid IP address length')
  return ipaddr.fromByteArray(Array.from(buffer.subarray(offset, offset + length))).toString()
}

function address () {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (!entry.internal && (entry.family === 'IPv4' || entry.family === 4)) return entry.address
    }
  }
  return '127.0.0.1'
}

function cidrSubnet (value) {
  const [address, bits] = ipaddr.parseCIDR(value)
  if (address.kind() !== 'ipv4') throw new Error('Expected IPv4 subnet')
  const count = 2 ** (32 - bits)
  const start = Math.floor(toLong(address.toString()) / count) * count
  const format = n => [24, 16, 8, 0].map(shift => (n >>> shift) & 255).join('.')
  return { networkAddress: format(start), broadcastAddress: format(start + count - 1), firstAddress: format(start + (count > 2 ? 1 : 0)), lastAddress: format(start + count - (count > 2 ? 2 : 1)) }
}

function isPublic (value) {
  try { return parse(value).range() === 'unicast' } catch (_) { return false }
}

module.exports = { address, toLong, toString, cidrSubnet, isPublic, isPrivate: value => !isPublic(value) }
