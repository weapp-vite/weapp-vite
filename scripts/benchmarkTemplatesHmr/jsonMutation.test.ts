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
