import { describe, expect, it } from 'vitest'
import { readMarkdownDocument } from './frontmatter'

describe('readMarkdownDocument', () => {
  it('resolves VitePress includes for document metadata consumers', async () => {
    const document = await readMarkdownDocument('wevu/api/core.md', { resolveIncludes: true })

    expect(document.headings).toContain('createApp() {#createapp}')
    expect(document.headings).toContain('defineModel() {#definemodel}')
    expect(document.body).not.toContain('<!--@include:')
  })
})
