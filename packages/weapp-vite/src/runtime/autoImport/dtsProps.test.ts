import { describe, expect, it } from 'vitest'
import { extractInlinePropsTypeFromCode } from './dtsProps'

describe('extractInlinePropsTypeFromCode', () => {
  it('extracts defineProps type literal members from script setup source', () => {
    const result = extractInlinePropsTypeFromCode(`
<script setup lang="ts">
defineProps<{
  sidebar?: boolean
  title?: string
}>()
</script>
    `.trim())

    expect([...result.entries()]).toEqual([
      ['sidebar', 'boolean'],
      ['title', 'string'],
    ])
  })
})
