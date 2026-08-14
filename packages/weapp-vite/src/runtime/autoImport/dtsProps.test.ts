import { describe, expect, it } from 'vitest'
import { extractInlinePropsTypeFromCode } from './dtsProps'

describe('extractInlinePropsTypeFromCode', () => {
  it('extracts defineProps type literal members from TypeScript source', () => {
    const result = extractInlinePropsTypeFromCode(`
defineProps<{
  sidebar?: boolean
  title?: string
}>()
    `.trim())

    expect([...result.entries()]).toEqual([
      ['sidebar', 'boolean'],
      ['title', 'string'],
    ])
  })
})
