export interface HtmlCustomDataAttributeValue {
  name: string
  description?: string
}

export interface HtmlCustomDataAttribute {
  name: string
  description?: string
  values?: HtmlCustomDataAttributeValue[]
}

export interface HtmlCustomDataTagReference {
  name: string
  url: string
}

export interface HtmlCustomDataTag {
  name: string
  description?: string
  attributes?: HtmlCustomDataAttribute[]
  references?: HtmlCustomDataTagReference[]
}
