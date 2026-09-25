import { expect, it } from 'vitest'
import { mutateJsonMarker } from './jsonMutation'

it('edits the sitemap description while preserving actual routing rules', () => {
  const original = { desc: '原说明', rules: [{ action: 'allow', page: '*' }] }
  expect(JSON.parse(mutateJsonMarker(JSON.stringify(original), 'marker'))).toEqual({ ...original, desc: 'marker' })
})

it('edits the app title without replacing its sitemap dependency', () => {
  const original = { window: { navigationBarTitleText: 'Original' }, sitemapLocation: 'sitemap.json' }
  expect(JSON.parse(mutateJsonMarker(JSON.stringify(original), 'marker'))).toEqual({ ...original, window: { navigationBarTitleText: 'marker' } })
})

it('rejects unsupported data instead of manufacturing an unknown property', () => {
  expect(() => mutateJsonMarker('{"sitemapLocation":"sitemap.json"}', 'marker')).toThrow('supported text field')
})

it('adds the supported app title to an empty window without changing routes or dependencies', () => {
  const original = { pages: ['pages/index/index'], window: {}, sitemapLocation: 'sitemap.json' }
  expect(JSON.parse(mutateJsonMarker(JSON.stringify(original), '新标题'))).toEqual({
    ...original,
    window: { navigationBarTitleText: '新标题' },
  })
  expect(JSON.parse(mutateJsonMarker(JSON.stringify({ ...original, window: { navigationStyle: 'custom' } }), 'marker'))).toEqual({
    ...original,
    window: { navigationStyle: 'custom', navigationBarTitleText: 'marker' },
  })
})
