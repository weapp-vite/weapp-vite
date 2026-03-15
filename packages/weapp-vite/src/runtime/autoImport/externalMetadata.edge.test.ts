import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const extractComponentPropsMock = vi.hoisted(() => vi.fn<(code: string) => Map<string, string>>())
const extractComponentPropsFromDtsMock = vi.hoisted(() => vi.fn<(code: string) => Map<string, string>>())

vi.mock('../componentProps', () => ({
  extractComponentProps: extractComponentPropsMock,
}))

vi.mock('./dtsProps', () => ({
  extractComponentPropsFromDts: extractComponentPropsFromDtsMock,
}))

function mapWith(entry: [string, string]) {
  return new Map([entry])
}

describe('loadExternalComponentMetadata edge branches', () => {
  const roots: string[] = []

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    extractComponentPropsMock.mockImplementation((code: string) => {
      if (code.includes('js-throw')) {
        throw new Error('js parse failed')
      }
      if (code.includes('js-hit')) {
        return mapWith(['fromJs', 'string'])
      }
      return new Map()
    })
    extractComponentPropsFromDtsMock.mockImplementation((code: string) => {
      if (code.includes('dts-throw')) {
        throw new Error('dts parse failed')
      }
      if (code.includes('dts-hit')) {
        return mapWith(['fromDts', 'number'])
      }
      return new Map()
    })
  })

  afterEach(async () => {
    await Promise.all(roots.map(root => fs.remove(root)))
    roots.length = 0
  })

  async function createRoot(prefix: string) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
    roots.push(root)
    await fs.outputJson(path.join(root, 'package.json'), { name: prefix, version: '0.0.0' })
    return root
  }

  it('uses fallback cache without resolvers and memoizes misses', async () => {
    const root = await createRoot('weapp-vite-meta-edge-fallback-')
    const { loadExternalComponentMetadata } = await import('./externalMetadata')

    expect(loadExternalComponentMetadata('/abs/not-supported', root)).toBeUndefined()
    expect(loadExternalComponentMetadata('/abs/not-supported', root)).toBeUndefined()

    expect(extractComponentPropsFromDtsMock).not.toHaveBeenCalled()
    expect(extractComponentPropsMock).not.toHaveBeenCalled()
  })

  it('loads metadata from generic relative imports when resolver heuristics skip', async () => {
    const root = await createRoot('weapp-vite-meta-edge-generic-')
    await fs.outputFile(path.join(root, 'local/button.mjs'), 'js-hit', 'utf8')

    const { loadExternalComponentMetadata } = await import('./externalMetadata')
    const meta = loadExternalComponentMetadata('./local/button.mjs', root, undefined, {
      astEngine: 'oxc',
    })

    expect(meta?.types.get('fromJs')).toBe('string')
    expect(extractComponentPropsMock).toHaveBeenCalledTimes(1)
    expect(extractComponentPropsMock).toHaveBeenCalledWith('js-hit', {
      astEngine: 'oxc',
    })
  })

  it('falls back to js metadata when dts parsing throws', async () => {
    const root = await createRoot('weapp-vite-meta-edge-resolver-')
    await fs.outputJson(path.join(root, 'node_modules/mock-lib/package.json'), { name: 'mock-lib', version: '0.0.0' })
    await fs.outputFile(path.join(root, 'node_modules/mock-lib/dist/button/index.d.ts'), 'dts-throw', 'utf8')
    await fs.outputFile(path.join(root, 'node_modules/mock-lib/dist/button/index.js'), 'js-hit', 'utf8')

    const resolver = {
      resolveExternalMetadataCandidates() {
        return {
          packageName: 'mock-lib',
          dts: ['dist/button/index.d.ts'],
          js: ['dist/button/index.js'],
        }
      },
    }

    const { loadExternalComponentMetadata } = await import('./externalMetadata')
    const meta = loadExternalComponentMetadata('mock-lib/button', root, [resolver])

    expect(meta?.types.get('fromJs')).toBe('string')
    expect(extractComponentPropsFromDtsMock).toHaveBeenCalledTimes(1)
    expect(extractComponentPropsMock).toHaveBeenCalledTimes(1)
  })

  it('resolves heuristic package candidates without explicit resolvers', async () => {
    const root = await createRoot('weapp-vite-meta-edge-heuristic-')
    await fs.outputJson(path.join(root, 'node_modules/plain-lib/package.json'), { name: 'plain-lib', version: '0.0.0' })
    await fs.outputFile(path.join(root, 'node_modules/plain-lib/miniprogram_dist/button.d.ts'), 'dts-hit', 'utf8')

    const { loadExternalComponentMetadata } = await import('./externalMetadata')
    const meta = loadExternalComponentMetadata('plain-lib/button', root)

    expect(meta?.types.get('fromDts')).toBe('number')
    expect(extractComponentPropsFromDtsMock).toHaveBeenCalledTimes(1)
  })

  it('stores null results when dts is empty and js parsing fails', async () => {
    const root = await createRoot('weapp-vite-meta-edge-null-')
    await fs.outputJson(path.join(root, 'node_modules/mock-empty/package.json'), { name: 'mock-empty', version: '0.0.0' })
    await fs.outputFile(path.join(root, 'node_modules/mock-empty/types.d.ts'), 'no-hit', 'utf8')
    await fs.outputFile(path.join(root, 'node_modules/mock-empty/index.js'), 'js-throw', 'utf8')

    const resolver = {
      resolveExternalMetadataCandidates() {
        return {
          packageName: 'mock-empty',
          dts: ['types.d.ts'],
          js: ['index.js'],
        }
      },
    }

    const resolvers = [resolver]
    const { loadExternalComponentMetadata } = await import('./externalMetadata')

    expect(loadExternalComponentMetadata('mock-empty/component', root, resolvers)).toBeUndefined()
    const firstDtsCount = extractComponentPropsFromDtsMock.mock.calls.length
    const firstJsCount = extractComponentPropsMock.mock.calls.length

    expect(loadExternalComponentMetadata('mock-empty/component', root, resolvers)).toBeUndefined()
    expect(extractComponentPropsFromDtsMock.mock.calls.length).toBe(firstDtsCount)
    expect(extractComponentPropsMock.mock.calls.length).toBe(firstJsCount)
  })

  it('separates cache entries by ast engine', async () => {
    const root = await createRoot('weapp-vite-meta-edge-engine-cache-')
    await fs.outputFile(path.join(root, 'local/cache.mjs'), 'js-hit', 'utf8')

    const { loadExternalComponentMetadata } = await import('./externalMetadata')
    loadExternalComponentMetadata('./local/cache.mjs', root, undefined, { astEngine: 'babel' })
    loadExternalComponentMetadata('./local/cache.mjs', root, undefined, { astEngine: 'babel' })
    loadExternalComponentMetadata('./local/cache.mjs', root, undefined, { astEngine: 'oxc' })

    expect(extractComponentPropsMock).toHaveBeenCalledTimes(2)
    expect(extractComponentPropsMock.mock.calls[0]?.[1]).toEqual({ astEngine: 'babel' })
    expect(extractComponentPropsMock.mock.calls[1]?.[1]).toEqual({ astEngine: 'oxc' })
  })

  it('falls back to import.meta require when cwd is invalid', async () => {
    const { loadExternalComponentMetadata } = await import('./externalMetadata')
    expect(loadExternalComponentMetadata('node:path', '\u0000bad-cwd')).toBeUndefined()
  })

  it('returns undefined when heuristic package root or generic resolution fails', async () => {
    const root = await createRoot('weapp-vite-meta-edge-missing-')
    const { loadExternalComponentMetadata } = await import('./externalMetadata')

    expect(loadExternalComponentMetadata('missing-lib/button', root)).toBeUndefined()
    expect(loadExternalComponentMetadata('./not-found-entry', root)).toBeUndefined()
    expect(loadExternalComponentMetadata('@scope-only', root)).toBeUndefined()
  })
})
