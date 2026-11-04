import { describe, expect, it } from 'vitest'
import { getCorpusProfile } from '../profiles'
import { readFrameworkCatalog, selectFrameworkTarget } from './catalog'

describe('official Taro markup target inventory', () => {
  it('registers ASCF, explicit Harmony JSUI, legacy JD and UX targets with independent profiles', async () => {
    const catalog = await readFrameworkCatalog()
    for (const version of ['4.3.2', '3.6.40']) {
      const { target } = selectFrameworkTarget(catalog, 'taro', version, 'ascf')
      expect(target).toMatchObject({ platform: 'ascf', profileId: 'ascf-xml', extensions: ['.hxml'], support: 'candidate' })
      expect(getCorpusProfile(target.profileId)).toMatchObject({ platform: 'ascf', rawTags: ['hjs'], syntax: 'xml' })
      expect(getCorpusProfile(target.profileId).parserPlatform).toBeUndefined()
    }
    const harmony = selectFrameworkTarget(catalog, 'taro', '4.3.2', 'harmony-jsui').target
    expect(harmony).toMatchObject({ platform: 'harmony', profileId: 'harmony-hml', extensions: ['.hml'] })
    expect(harmony.evidence).toContain('@tarojs/plugin-platform-harmony-ets@4.3.2 disableArkTS=true')
    expect(selectFrameworkTarget(catalog, 'taro', '2.2.22', 'jd').target.extensions).toEqual(['.jxml'])
    expect(selectFrameworkTarget(catalog, 'taro', '2.2.22', 'quickapp').target).toMatchObject({ platform: 'quickapp', extensions: ['.ux'], container: 'template' })
    for (const release of catalog.filter(release => release.framework === 'taro')) {
      expect(release.targets.some(target => ['harmony-hybrid', 'harmony-cpp', 'harmony-arkts'].includes(target.target))).toBe(false)
      for (const target of release.targets) {
        expect(getCorpusProfile(target.profileId).platform).toBe(target.platform)
      }
    }
  })
})
