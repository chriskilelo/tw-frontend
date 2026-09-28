export interface TileTone {
  selected: string
  indicator: string
  icon: string
}

export const NEUTRAL_TONE: TileTone = {
  selected: 'border-primary bg-page-bg ring-4 ring-primary/10',
  indicator: 'border-primary bg-primary',
  icon: 'bg-section-bg text-primary',
}
