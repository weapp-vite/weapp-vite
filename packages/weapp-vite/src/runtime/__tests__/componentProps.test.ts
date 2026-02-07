import { describe, expect, it } from 'vitest'
import { extractComponentProps } from '../componentProps'

describe('extractComponentProps', () => {
  it('extracts properties from mini program component options', () => {
    const code = `
Component({
  properties: {
    title: String,
    count: {
      type: Number,
      optionalTypes: [String],
    },
    visible: Boolean,
    payload: Object,
    tags: Array,
    anyValue: null,
    mode: [String, Number],
    'custom-prop': String,
  },
})
`

    const result = extractComponentProps(code)

    expect(Array.from(result.entries())).toEqual([
      ['title', 'string'],
      ['count', 'number | string'],
      ['visible', 'boolean'],
      ['payload', 'Record<string, any>'],
      ['tags', 'any[]'],
      ['anyValue', 'any'],
      ['mode', 'string | number'],
      ['custom-prop', 'string'],
    ])
  })

  it('extracts props when defineComponent options are identifier bindings', () => {
    const code = `
const __default__ = {
  props: {
    title: String,
    score: {
      type: Number,
      optionalTypes: [String],
    },
    enabled: Boolean,
    tags: Array,
    payload: Object,
    mode: [String, Number],
    customProp: String,
  },
}

export default defineComponent(__default__)
`

    const result = extractComponentProps(code)

    expect(Array.from(result.entries())).toEqual([
      ['title', 'string'],
      ['score', 'number | string'],
      ['enabled', 'boolean'],
      ['tags', 'any[]'],
      ['payload', 'Record<string, any>'],
      ['mode', 'string | number'],
      ['customProp', 'string'],
    ])
  })

  it('supports TS wrappers around options identifiers', () => {
    const code = `
const options = {
  props: {
    level: Number,
  },
}

Component(options as any)
`

    const result = extractComponentProps(code)
    expect(Array.from(result.entries())).toEqual([
      ['level', 'number'],
    ])
  })
})
