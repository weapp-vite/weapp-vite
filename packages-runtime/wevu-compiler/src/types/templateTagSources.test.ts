import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../plugins/vue/transform/compileVueFile'

describe('original template tag sources', () => {
  it.each(['\n', '\r\n', '\r'])('retains inline SFC positions before generated template formatting for %j', async (newline) => {
    const source = ['<script setup>const value = 1</script>', '<template>', '  <buton>{{ value }}</buton>', '</template>'].join(newline)
    const result = await compileVueFile(source, 'pages/home/index.vue')
    expect(result.meta?.templateTags).toContainEqual(expect.objectContaining({
      tag: 'buton',
      filename: 'pages/home/index.vue',
      loc: expect.objectContaining({ start: { offset: source.indexOf('<buton>'), line: 3, column: 3 } }),
    }))
  })

  it('attributes an external template to its own source', async () => {
    const source = '<view>\r\n  <missing-card />\r\n</view>'
    const externalFilename = resolve('pages/home/part.html')
    const result = await compileVueFile('<template src="./part.html" />', resolve('pages/home/index.vue'), {
      sfcSrc: {
        resolveId: async () => externalFilename,
        readFile: async () => source,
      },
    })
    expect(result.meta?.templateTags).toContainEqual(expect.objectContaining({
      tag: 'missing-card',
      filename: externalFilename.replaceAll('\\', '/'),
      loc: expect.objectContaining({ start: { offset: source.indexOf('<missing-card'), line: 2, column: 3 } }),
    }))
  })
})
