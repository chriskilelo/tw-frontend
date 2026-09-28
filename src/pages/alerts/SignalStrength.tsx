/** Signal-strength glyph for the confidence scale: `level` of 4 bars filled. */
export function SignalStrength({ level }: { level: number }) {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={`w-1 rounded-[1px] ${bar <= level ? 'bg-primary-lightest' : 'bg-border-muted'}`}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </span>
  )
}
