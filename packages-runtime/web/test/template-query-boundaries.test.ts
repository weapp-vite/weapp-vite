import { expect, it } from 'vitest'
import { appendTemplateInputQuery, readTemplateInputQuery } from '../src/shared/templateInputQuery'

it('preserves existing module queries when attaching explicit template input rules', () => {
  const input = { platform: 'tt', syntax: 'xml', rawTags: ['sjs'] } as const
  const request = appendTemplateInputQuery('/page.wxml?template', { ...input, rawTags: [...input.rawTags] })
  expect(request).toMatch(/^\/page\.wxml\?template&weapp-web-input=/)
  expect(readTemplateInputQuery(request)).toEqual(input)
  expect(readTemplateInputQuery('/page.wxml?template')).toBeUndefined()
  expect(readTemplateInputQuery('/page.wxml')).toBeUndefined()
  expect(readTemplateInputQuery(appendTemplateInputQuery('/page.wxml', { platform: 'tt' }))).toEqual({ platform: 'tt' })
})
