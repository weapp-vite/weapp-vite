import { describe, expect, it } from 'vitest'
import * as core from '../../../packages/wxml/src/core'
import * as root from '../../../packages/wxml/src/index'
import { createCoreTemplateApi } from './coreApi'
import { runEntryContracts } from './entryContracts'

describe('direct public entry contracts', () => {
  it.each([['root', root], ['core', core]] as const)('accepts the actual %s module independently of the corpus adapter', (variant, module) => {
    const report = runEntryContracts(module, variant)
    expect(report.accepted).toBe(true)
    expect(report.failures).toEqual([])
    expect(report.checks).toHaveLength(3)
  })

  it('rejects compatibility surface and metadata on the core entry', () => {
    expect(runEntryContracts({ ...core, parse: root.parse }, 'core')).toMatchObject({ accepted: false, failures: [expect.objectContaining({ check: 'public-surface' })] })
    const wrapped = {
      ...core,
      createParser: (...parameters: Parameters<typeof core.createParser>) => {
        const parser = core.createParser(...parameters)
        return { ...parser, parse: (source: string) => ({ ...parser.parse(source), platform: 'weapp' }) }
      },
    }
    expect(runEntryContracts(wrapped, 'core').failures).toContainEqual(expect.objectContaining({ check: 'core-document-and-context' }))
  })

  it('refuses to substitute the metadata adapter for the actual core module', () => {
    expect(runEntryContracts(createCoreTemplateApi(core), 'core').accepted).toBe(false)
  })

  it('detects root default drift even when explicit frozen options would pass', () => {
    const wrapped = { ...root, parse: (source: string, options = {}) => root.parse(source, { platform: 'alipay', ...options }) }
    expect(runEntryContracts(wrapped, 'root').failures).toContainEqual(expect.objectContaining({ check: 'root-default-compatibility' }))
  })
})
