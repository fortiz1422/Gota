interface Props {
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function BlueHeaderZone({ children, className = '', style }: Props) {
  return (
    <div className={`blue-zone relative shrink-0 ${className}`} style={style}>
      {children}
    </div>
  )
}
