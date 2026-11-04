import type { CorpusDocument, CorpusMetadata } from './types'
import { describe, expect, it } from 'vitest'
import { parseDiscoveryInput } from './index'
import { corpusPolicy } from './profiles'
import { inventoryCorpus } from './report'
import { auditFrameworkMatrix } from './report/framework'

const metadata: CorpusMetadata = {
  id: 'test',
  profiles: [],
  licenses: [],
  discovery: [],
  generations: [],
  repositories: [{ repository: 'example/source', commit: 'a'.repeat(40), independentRepository: 'example/upstream', licenseId: 'mit', treeSha256: 'tree', treeFiles: 10, selectedFiles: 2, excludedFiles: 0, complete: true }],
  policy: { minimumDocuments: 2, minimumRepositories: 1, minimumNonWechatDocuments: 1, platformMinimums: { weapp: 1, alipay: 1 } },
}

describe('deduplicated corpus inventory', () => {
  it('counts shared platform memberships without multiplying global documents', () => {
    const origin = { repository: 'example/source', commit: 'a'.repeat(40), path: 'page.wxml', platform: 'weapp', profileId: 'weapp', category: 'native' as const, licenseId: 'mit', expectation: 'valid' as const }
    const documents: CorpusDocument[] = [
      { sha256: 'a', source: '<view/>', origins: [origin, { ...origin, platform: 'alipay', category: 'generated' }] },
      { sha256: 'b', source: '<text/>', origins: [origin] },
    ]
    const report = inventoryCorpus(documents, metadata)
    expect(report.accepted).toBe(false)
    expect(report.gaps).toContain('manifest policy below hard minimum global unique documents: 2/10000')
    expect(report.documents).toBe(2)
    expect(report.origins).toBe(3)
    expect(report.repositories).toBe(1)
    expect(report.nonWechatDocuments).toBe(1)
    expect(report.platforms.alipay).toEqual({ documents: 1, origins: 1, native: 0, expected: 0, generated: 1 })
  })

  it('fails closed for missing quotas, pending inputs, incomplete sources and failed compiler cells', () => {
    const report = inventoryCorpus([{ sha256: 'a', source: '<view/>', origins: [{ repository: 'example/source', commit: 'a'.repeat(40), path: 'a', platform: 'weapp', profileId: 'weapp', category: 'native', licenseId: 'mit', expectation: 'pending' }] }], {
      ...metadata,
      repositories: [{ ...metadata.repositories[0]!, complete: false }],
      generations: [{ id: 'uni-development', framework: 'uni', version: '1', target: 'wx', mode: 'development', status: 'failed', evidence: [] }],
    })
    expect(report.accepted).toBe(false)
    expect(report.gaps).toContain('global unique documents: 1/10000')
    expect(report.gaps).toContain('independent repositories: 0/200')
    expect(report.gaps).toContain('non-WeChat unique documents: 0/5000')
    expect(report.gaps).toContain('alipay: 0/500')
    expect(report.gaps).toContain('pending origin classifications: 1')
    expect(report.gaps).toContain('framework cell uni-development: failed')
  })

  it('never lowers official quotas and respects explicitly stricter manifests', () => {
    const weakened = inventoryCorpus([], { ...metadata, policy: { minimumDocuments: 0, minimumRepositories: 0, minimumNonWechatDocuments: 0, platformMinimums: {} } })
    expect(weakened.gaps).toContain('weapp: 0/500')
    expect(weakened.gaps).toContain('ty: 0/100')
    const stricter = inventoryCorpus([], { ...metadata, policy: { ...corpusPolicy, minimumDocuments: 20_000, platformMinimums: { ...corpusPolicy.platformMinimums, weapp: 1000 } } })
    expect(stricter.gaps).toContain('global unique documents: 0/20000')
    expect(stricter.gaps).toContain('weapp: 0/1000')
    expect(stricter.gaps.some(gap => gap.startsWith('manifest policy below'))).toBe(false)
  })
})

describe('discovery input evidence', () => {
  it('accepts the native discover report and frozen page arrays with truncation intact', () => {
    const pages = [{ query: 'wxml', page: 2, totalCount: 1234, incompleteResults: true, repositories: ['owner/project'] }]
    expect(parseDiscoveryInput(pages)).toEqual(pages)
    expect(parseDiscoveryInput({ discovery: pages, repositories: [] })).toEqual(pages)
    expect(() => parseDiscoveryInput({ repositories: [] })).toThrow('page array')
    expect(() => parseDiscoveryInput([{ ...pages[0], page: 0 }])).toThrow('pagination')
    expect(() => parseDiscoveryInput([{ ...pages[0], repositories: ['../escape'] }])).toThrow('page result')
  })
})

describe('complete framework acceptance matrix', () => {
  const target = { target: 'weapp', platform: 'weapp', profileId: 'weapp-legacy', extensions: ['.wxml'], support: 'candidate' as const, evidence: 'https://upstream.example/frozen/targets' }
  const catalog = [{ framework: 'taro' as const, version: '4.3.2', compiler: '@tarojs/cli', targets: [target, { ...target, target: 'unsupported', support: 'unsupported' as const }] }]
  const generation = (target: string, mode: string, status: 'built' | 'unsupported' | 'failed' = 'built') => ({ id: `${target}-${mode}`, framework: 'taro', version: '4.3.2', target, mode, status, evidence: [{ file: `evidence/${mode}.json`, sha256: 'a'.repeat(64), bytes: 100 }] })

  it('requires both modes of every registered version and target', async () => {
    const matrix = await auditFrameworkMatrix([generation('weapp', 'development')], catalog)
    expect(matrix.accepted).toBe(false)
    expect(matrix.gaps).toContain('missing framework cell taro@4.3.2/weapp/production')
    expect(matrix.cells).toHaveLength(4)
  })

  it('rejects fake unsupported declarations, unregistered modes and absent evidence', async () => {
    const matrix = await auditFrameworkMatrix([generation('weapp', 'development', 'unsupported'), generation('weapp', 'staging'), { ...generation('weapp', 'production'), evidence: [] }], catalog)
    expect(matrix.gaps).toContain('framework cell taro@4.3.2/weapp/development: unsupported, expected built')
    expect(matrix.gaps).toContain('unregistered framework cell taro@4.3.2/weapp/staging')
    expect(matrix.gaps).toContain('framework cell taro@4.3.2/weapp/production: missing frozen evidence')
  })

  it('accepts only the exact upstream unsupported target and complete built cells', async () => {
    const generations = ['development', 'production'].flatMap(mode => [generation('weapp', mode), generation('unsupported', mode, 'unsupported')])
    const matrix = await auditFrameworkMatrix(generations, catalog)
    expect(matrix.accepted).toBe(true)
    expect(matrix.gaps).toEqual([])
  })
})
