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

    expect([...result.entries()]).toEqual([
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

    expect([...result.entries()]).toEqual([
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
    expect([...result.entries()]).toEqual([
      ['level', 'number'],
    ])
  })

  it('handles sparse optionalTypes and computed member constructors', () => {
    const code = `
const extraTypes = [Boolean]
const wxTypes = [String]

Component({
  properties: {
    mixed: {
      type: wxTypes[0],
      optionalTypes: [, ...extraTypes, String],
    },
  },
})
`

    const result = extractComponentProps(code)

    expect([...result.entries()]).toEqual([
      ['mixed', 'any | string'],
    ])
  })

  it('returns empty props for non-object declarations and absent props keys', () => {
    const codeWithSpread = `
const base = { props: { ghost: String } }

Component({
  ...base,
  props: getProps(),
})
`
    const codeWithoutProps = `
Component({
  data: {
    count: 1,
  },
})
`

    expect([...extractComponentProps(codeWithSpread).entries()]).toEqual([])
    expect([...extractComponentProps(codeWithoutProps).entries()]).toEqual([])
  })

  it('skips unsupported property/option node shapes while keeping valid entries', () => {
    const code = `
const dynamicKey = 'dynamic'
const foo = { bar: 'computed' }
const extra = { type: Boolean }

Component({
  properties: {
    ...spreadProps,
    [foo.bar]: String,
    supported: {
      ...extra,
      [foo.bar]: String,
      optionalTypes: [String],
    },
  },
})
`

    const result = extractComponentProps(code)
    expect([...result.entries()]).toEqual([
      ['supported', 'string'],
    ])
  })

  it('resolves literal/member constructor variants and numeric prop names', () => {
    const code = `
const Wechat = { String, Boolean }
const extraTypes = [String]

Component({
  properties: {
    1: { type: 'String' },
    memberByIdentifier: { type: Wechat.String },
    memberByLiteral: { type: Wechat['Boolean'] },
    literalNumber: { type: 1 },
    literalBoolean: { type: true },
    wrapped: { type: (String as any) },
    spreadMode: [...extraTypes],
    emptyMode: [,],
  },
})
`

    const result = extractComponentProps(code)
    expect([...result.entries()]).toEqual([
      ['1', 'string'],
      ['memberByIdentifier', 'string'],
      ['memberByLiteral', 'boolean'],
      ['literalNumber', 'number'],
      ['literalBoolean', 'boolean'],
      ['wrapped', 'string'],
      ['spreadMode', 'any'],
      ['emptyMode', 'any'],
    ])
  })

  it('returns empty map when identifier bindings are non-object or call expressions', () => {
    const code = `
const optionsFromCall = getOptions()
Component(optionsFromCall)
Component(getOptions())
`

    expect([...extractComponentProps(code).entries()]).toEqual([])
  })

  it('keeps the first extracted props map when later call expressions are visited', () => {
    const code = `
Component({
  properties: {
    first: String,
  },
})

Component({
  properties: {
    second: Number,
  },
})
`

    const result = extractComponentProps(code)
    expect([...result.entries()]).toEqual([
      ['first', 'string'],
    ])
  })

  it('supports extracting props with the oxc engine', () => {
    const code = `
const options = {
  props: {
    title: String,
    score: {
      type: Number,
      optionalTypes: [String],
    },
  },
}

Component(options as any)
`

    const result = extractComponentProps(code, { astEngine: 'oxc' })
    expect([...result.entries()]).toEqual([
      ['title', 'string'],
      ['score', 'number | string'],
    ])
  })

  it('keeps babel and oxc results aligned for unsupported shapes', () => {
    const code = `
const extraTypes = [Boolean]
const wxTypes = [String]

Component({
  properties: {
    mixed: {
      type: wxTypes[0],
      optionalTypes: [, ...extraTypes, String],
    },
    supported: {
      optionalTypes: [String],
    },
  },
})
`

    expect([...extractComponentProps(code, { astEngine: 'babel' }).entries()]).toEqual(
      [...extractComponentProps(code, { astEngine: 'oxc' }).entries()],
    )
  })
})
