import { describe, expect, it } from 'vitest'
import { extractComponentPropsFromDts } from '../../src/runtime/autoImport/dtsProps'

describe('extractComponentPropsFromDts', () => {
  it('extracts component properties from interface declarations', () => {
    const code = `
export interface MyComponent {
  properties: {
    foo: { type: StringConstructor }
    bar: { value: number }
    baz: { value: import("some-pkg").Baz; type: NumberConstructor }
    mixed: { type: StringConstructor | NumberConstructor }
    nil: { type: null }
    "kebab-case": { type: BooleanConstructor }
  }
}
`

    const props = extractComponentPropsFromDts(code)
    expect(Object.fromEntries(props)).toEqual({
      'foo': 'string',
      'bar': 'number',
      'baz': 'number',
      'mixed': 'string | number',
      'nil': 'any',
      'kebab-case': 'boolean',
    })
  })

  it('extracts component properties from class declarations', () => {
    const code = `
export declare class MyComponent {
  properties: {
    foo: { type: StringConstructor }
  }
}
`

    const props = extractComponentPropsFromDts(code)
    expect(Object.fromEntries(props)).toEqual({
      foo: 'string',
    })
  })
})
