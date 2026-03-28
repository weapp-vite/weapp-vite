import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addStyleEntry,
  appendDefaultScopedStyleEntries,
  createStyleEntryDedupeKey,
  resolveDefaultScopedStyleEntryCandidates,
} from './entries'

function createConfigService(absoluteSrcRoot: string) {
  return {
    absoluteSrcRoot,
    outputExtensions: {
      wxss: 'wxss',
    },
    relativeOutputPath(id: string) {
      const relative = path.relative(absoluteSrcRoot, id)
      if (relative.startsWith('..')) {
        return undefined
      }
      return relative.split(path.sep).join('/')
    },
  } as any
}

describe('styleEntries entries', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-style-entry-entries-'))
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('builds stable dedupe keys from normalized output and scopes', () => {
    expect(createStyleEntryDedupeKey('pkgA/index.wxss', ['**/*'], ['pages/internal/**'])).toBe(
      JSON.stringify({
        file: 'pkgA/index.wxss',
        include: ['**/*'],
        exclude: ['pages/internal/**'],
      }),
    )
  })

  it('resolves default scoped style entry candidates in config order', () => {
    const candidates = resolveDefaultScopedStyleEntryCandidates('/project/src', 'packages/order')

    expect(candidates[0]).toEqual({
      base: 'index',
      scope: 'all',
      filename: 'index.wxss',
      absolutePath: '/project/src/packages/order/index.wxss',
    })
    expect(candidates.at(-1)).toEqual({
      base: 'components',
      scope: 'components',
      filename: 'components.sss',
      absolutePath: '/project/src/packages/order/components.sss',
    })
  })

  it('skips entries whose normalized include/exclude key already exists', () => {
    const entries: any[] = []
    const dedupe = new Set<string>()

    addStyleEntry({
      source: 'shared.scss',
      scope: 'components',
      include: ['components/**'],
      exclude: ['components/internal/**'],
      explicitScope: true,
    }, '/project/src/shared.scss', 'shared.wxss', 'packages/order', 'packages/order', dedupe, entries)

    addStyleEntry({
      source: 'shared-duplicate.scss',
      scope: 'components',
      include: ['./components/**'],
      exclude: ['./components/internal/**'],
      explicitScope: true,
    }, '/project/src/shared-duplicate.scss', 'shared.wxss', 'packages/order', 'packages/order', dedupe, entries)

    expect(entries).toEqual([
      {
        source: 'shared.scss',
        absolutePath: '/project/src/shared.scss',
        outputRelativePath: 'shared.wxss',
        inputExtension: '.scss',
        scope: 'components',
        include: ['components/**'],
        exclude: ['components/internal/**'],
      },
    ])
  })

  it('appends only the first existing default file for each scoped base', async () => {
    await fs.mkdir(path.join(tempRoot, 'packages/order'), { recursive: true })
    await fs.writeFile(path.join(tempRoot, 'packages/order/index.scss'), '')
    await fs.writeFile(path.join(tempRoot, 'packages/order/index.less'), '')
    await fs.writeFile(path.join(tempRoot, 'packages/order/pages.less'), '')
    await fs.writeFile(path.join(tempRoot, 'packages/order/components.sss'), '')

    const entries: any[] = []
    appendDefaultScopedStyleEntries(
      'packages/order',
      'packages/order',
      createConfigService(tempRoot),
      new Set(),
      entries,
    )

    expect(entries).toEqual([
      expect.objectContaining({
        source: 'index.scss',
        outputRelativePath: 'packages/order/index.wxss',
        scope: 'all',
      }),
      expect.objectContaining({
        source: 'pages.less',
        outputRelativePath: 'packages/order/pages.wxss',
        scope: 'pages',
      }),
      expect.objectContaining({
        source: 'components.sss',
        outputRelativePath: 'packages/order/components.wxss',
        scope: 'components',
      }),
    ])
  })
})
