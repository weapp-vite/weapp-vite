import { describe, expect, it } from 'vitest'
import { isPartialDocument, readMarkdownDocument } from './frontmatter'

describe('isPartialDocument', () => {
  it('excludes shared fragments while preserving standalone pages', () => {
    expect(isPartialDocument('.partials/wevu-template/compatibility-matrix.md')).toBe(true)
    expect(isPartialDocument('wevu/_fragment.md')).toBe(true)
    expect(isPartialDocument('wevu/vue-sfc/template.md')).toBe(false)
    expect(isPartialDocument('wevu/partials-guide.md')).toBe(false)
  })
})

describe('readMarkdownDocument', () => {
  it('resolves VitePress includes for document metadata consumers', async () => {
    const document = await readMarkdownDocument('wevu/api/core.md', { resolveIncludes: true })

    expect(document.headings).toContain('createApp() {#createapp}')
    expect(document.headings).toContain('defineModel() {#definemodel}')
    expect(document.body).not.toContain('<!--@include:')
  })
})
