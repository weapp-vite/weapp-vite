import type { LanguagePlatform } from '../types'

export interface ComponentAttribute {
  name: string
  type?: { name: string }
  desc?: string[]
  enum?: { value: string, desc?: string[] }[]
  defaultValue?: string
  since?: string
  subAttrs?: { equal: string, attrs?: ComponentAttribute[] }[]
}

export interface ComponentEntry {
  name: string
  docLink: string
  desc?: string[]
  attrs: ComponentAttribute[]
}

export interface ComponentSchema {
  platform: LanguagePlatform
  availability: 'snapshot' | 'unavailable'
  version: string
  source: string
  snapshotDate: string
  upstreamRetrievedAt: string | null
  reason?: string
  components: ComponentEntry[]
}
