import { describe, expect, it } from 'vitest'
import { resolveExternalMetadataCandidates } from './externalMetadata'

describe('resolveExternalMetadataCandidates', () => {
  it('resolves @vant/weapp metadata candidates', () => {
    expect(resolveExternalMetadataCandidates('@vant/weapp/button')).toEqual({
      packageName: '@vant/weapp',
      dts: ['lib/button/index.d.ts', 'dist/button/index.d.ts'],
      js: ['lib/button/index.js', 'dist/button/index.js'],
    })
  })

  it('resolves tdesign-miniprogram metadata candidates', () => {
    expect(resolveExternalMetadataCandidates('tdesign-miniprogram/button/button')).toEqual({
      packageName: 'tdesign-miniprogram',
      dts: ['miniprogram_dist/button/button.d.ts'],
      js: ['miniprogram_dist/button/button.js'],
    })
  })

  it('returns undefined for unrelated imports', () => {
    expect(resolveExternalMetadataCandidates('some-lib/button')).toBeUndefined()
  })
})
