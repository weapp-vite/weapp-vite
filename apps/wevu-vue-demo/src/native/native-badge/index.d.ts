export interface NativeBadgeProps {
  readonly text?: string
  readonly type?: 'info' | 'success' | 'warning'
}

declare const NativeBadge: new () => {
  $props: NativeBadgeProps
}

export default NativeBadge
