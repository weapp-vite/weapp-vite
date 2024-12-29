export interface WxmlDep {
  tagName: string
  start: number
  end: number
  quote: string | null | undefined
  name: string
  value: string
  attrs: Record<string, string>
}

export interface ScanComponentItem {
  start: number
  end: number
}

export type ComponentsMap = Record<string, ScanComponentItem[]>
