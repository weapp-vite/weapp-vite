export interface MiniprogramComponentAttributeValue {
  desc?: string[]
  detail?: string
  value: string
}

export interface MiniprogramComponentAttributeConditionalValue {
  attrs?: MiniprogramComponentAttribute[]
  equal: string
}

export interface MiniprogramComponentAttributeType {
  name?: string
}

export interface MiniprogramComponentAttribute {
  defaultValue?: string
  desc?: string[]
  enum?: MiniprogramComponentAttributeValue[]
  name: string
  since?: string
  subAttrs?: MiniprogramComponentAttributeConditionalValue[]
  type?: MiniprogramComponentAttributeType
}

export interface MiniprogramComponentEntry {
  attrs?: MiniprogramComponentAttribute[]
  demoImages?: string[]
  desc?: string[]
  docLink?: string
  name: string
  tips?: string[]
}

export interface MiniprogramComponentIndexEntry extends MiniprogramComponentEntry {
  attrsByName: Map<string, MiniprogramComponentAttribute>
}

export interface ResolvedMiniprogramAttributeMatch {
  attribute: MiniprogramComponentAttribute
  condition: {
    attributeName: string
    value: string
  } | null
}
