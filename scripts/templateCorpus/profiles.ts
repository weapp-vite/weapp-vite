import type { CorpusPolicy, CorpusProfile } from './types'

/** 固定真实方言配置；收集失败不能自动切换语法绕过。 */
export const corpusProfiles: CorpusProfile[] = [
  { id: 'weapp-legacy', platform: 'weapp', parserPlatform: 'weapp', syntax: 'legacy', rawTags: ['wxs'], resolver: 'none' },
  { id: 'alipay-xml', platform: 'alipay', parserPlatform: 'alipay', syntax: 'xml', rawTags: ['import-sjs', 'sjs'], resolver: 'none' },
  { id: 'swan-xml', platform: 'swan', parserPlatform: 'swan', syntax: 'xml', rawTags: ['filter', 'import-sjs'], resolver: 'none' },
  { id: 'tt-xml', platform: 'tt', parserPlatform: 'tt', syntax: 'xml', rawTags: ['sjs', 'wxs'], resolver: 'none' },
  { id: 'jd-xml', platform: 'jd', parserPlatform: 'jd', syntax: 'xml', rawTags: ['jds', 'wxs'], resolver: 'none' },
  { id: 'xhs-xml', platform: 'xhs', parserPlatform: 'xhs', syntax: 'xml', rawTags: ['wxs'], resolver: 'none' },
  { id: 'qq-xml', platform: 'qq', parserPlatform: 'qq', syntax: 'xml', rawTags: ['qs', 'wxs'], resolver: 'none' },
  { id: 'ks-xml', platform: 'ks', parserPlatform: 'ks', syntax: 'xml', rawTags: ['ks'], resolver: 'none' },
  { id: 'ty-xml', platform: 'ty', parserPlatform: 'ty', syntax: 'xml', rawTags: ['sjs'], resolver: 'none' },
  { id: 'taobao-xml', platform: 'taobao', syntax: 'xml', rawTags: [], resolver: 'none' },
  { id: 'dd-xml', platform: 'dd', syntax: 'xml', rawTags: ['dds'], resolver: 'none' },
  { id: 'lark-xml', platform: 'lark', syntax: 'xml', rawTags: ['sjs'], resolver: 'none' },
  { id: 'qa-xml', platform: 'qa', syntax: 'xml', rawTags: ['qjs'], resolver: 'none' },
  { id: 'quickapp-template', platform: 'quickapp', syntax: 'xml', rawTags: [], resolver: 'none' },
  { id: 'quickapp-qxml', platform: 'quickapp', syntax: 'xml', rawTags: ['qjs'], resolver: 'none' },
  { id: '360-xml', platform: '360', syntax: 'xml', rawTags: [], resolver: 'none' },
  { id: 'harmony-template', platform: 'harmony', syntax: 'xml', rawTags: [], resolver: 'none' },
  { id: 'harmony-hxml', platform: 'harmony', syntax: 'xml', rawTags: ['hjs'], resolver: 'none' },
  { id: 'harmony-hml', platform: 'harmony', syntax: 'xml', rawTags: [], resolver: 'none' },
  { id: 'ascf-xml', platform: 'ascf', syntax: 'xml', rawTags: ['hjs'], resolver: 'none' },
]

export const corpusPolicy: CorpusPolicy = {
  minimumDocuments: 10_000,
  minimumRepositories: 200,
  minimumNonWechatDocuments: 5_000,
  platformMinimums: { weapp: 500, alipay: 500, swan: 500, tt: 500, jd: 500, xhs: 500, qq: 100, ks: 100, ty: 100 },
}

/** 只接受清单已登记的配置，避免隐式方言回退。 */
export function getCorpusProfile(id: string, profiles: readonly CorpusProfile[] = corpusProfiles): CorpusProfile {
  const profile = profiles.find(candidate => candidate.id === id)
  if (!profile) {
    throw new Error(`Unknown corpus profile: ${id}`)
  }
  return profile
}
