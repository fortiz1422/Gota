interface Props {
  label: string
}

export function SectionDivider({ label }: Props) {
  return (
    <div className="mx-5 my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-separator" />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        {label}
      </span>
      <div className="h-px flex-1 bg-separator" />
    </div>
  )
}
