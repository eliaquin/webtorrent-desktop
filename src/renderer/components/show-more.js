const { Button } = require('./ui')
const React = require('react')

/** @param {{defaultExpanded?: boolean, hideLabel?: string, showLabel?: string, style?: import('react').CSSProperties, children?: import('react').ReactNode}} props */
function ShowMore ({ defaultExpanded = false, hideLabel = 'Hide more...', showLabel = 'Show more...', style, children }) {
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  return (
    <div className='show-more' style={style}>
      {expanded ? children : null}
      <Button className='control' onClick={() => setExpanded(value => !value)} label={expanded ? hideLabel : showLabel} />
    </div>
  )
}

module.exports = ShowMore
