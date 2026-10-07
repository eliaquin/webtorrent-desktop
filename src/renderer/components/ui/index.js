// Native controls keep the UI independent of third-party component frameworks.
function Button ({ label, children, variant = 'raised', primary = false, className = '', ...props }) {
  return (
    <button
      type='button'
      {...props}
      className={`ui-button ui-button-${variant}${primary ? ' ui-button-primary' : ''} ${className}`}
    >
      {label || children}
    </button>
  )
}

function Checkbox ({ label, className = '', style, onClick, ...props }) {
  return (
    <label className={`ui-checkbox ${className}`} style={style} onClick={onClick}>
      <input type='checkbox' {...props} />
      {label && <span>{label}</span>}
    </label>
  )
}

// Refs point to the native input/textarea, so callers can focus or select it.
function TextField ({ multiline = false, fullWidth = false, rows = 2, rowsMax = 10, className = '', style, inputStyle, textareaStyle, ref, ...props }) {
  const Input = multiline ? 'textarea' : 'input'
  const fieldStyle = multiline
    ? { maxHeight: rowsMax * 21 + 16, ...textareaStyle }
    : inputStyle
  return (
    <div className={`ui-text-field ${className}`} style={{ width: fullWidth ? '100%' : undefined, ...style }}>
      <Input
        {...props}
        ref={ref}
        rows={multiline ? rows : undefined}
        type={multiline ? undefined : 'text'}
        style={fieldStyle}
      />
    </div>
  )
}

function ProgressBar ({ value, className = '', ...props }) {
  const progress = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  return <progress {...props} className={`ui-progress ${className}`} max={100} value={progress} />
}

module.exports = { Button, Checkbox, TextField, ProgressBar }
