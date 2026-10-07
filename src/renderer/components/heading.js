const React = require('react')
const colors = require('./ui/colors')

/** @param {{ level?: 1|2|3|4|5|6, children?: import('react').ReactNode }} props */
function Heading ({ level = 1, children }) {
  const Tag = 'h' + level
  return <Tag style={{ color: colors.grey100, fontSize: 20, marginBottom: 15, marginTop: 30 }}>{children}</Tag>
}

module.exports = Heading
