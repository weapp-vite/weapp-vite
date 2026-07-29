import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { generateEntryModule } from '../src/plugin/entry'
import { readJsonFile, resolveJsonPath } from '../src/plugin/files'
import { discoverWebPageIds, parseSfcJsonConfig } from '../src/plugin/scanSfc'

describe('web plugin final boundary contracts', () => {
  it('emits explicit form runtime options', () => {
    const code = generateEntryModule({
      pages: [],
      components: [],
      layouts: [],
    }, '/project', undefined, {
      __runtimeProvider: { moduleId: 'virtual:runtime' },
      form: { preventDefault: false },
    })
    expect(code).toContain('"form":{"preventDefault":false}')

    const finiteDesign = generateEntryModule({ pages: [], components: [], layouts: [] }, '/project', {
      pxPerRpx: 1,
      designWidth: 375,
      rpxVar: '--unit',
    }, { __runtimeProvider: { moduleId: 'virtual:runtime' } })
    expect(finiteDesign).toContain('"designWidth":375')
    expect(finiteDesign).toContain('"varName":"--unit"')

    const noRuntimeOptions = generateEntryModule({ pages: [], components: [], layouts: [] }, '/project', {
      pxPerRpx: 1,
      designWidth: Number.NaN,
    }, { __runtimeProvider: { moduleId: 'virtual:runtime' } })
    expect(noRuntimeOptions).toContain('initializePageRoutes([])')
  })

  it('handles malformed SFC configs and script-only page candidates', async () => {
    expect(parseSfcJsonConfig('{invalid')).toBeUndefined()
    expect(parseSfcJsonConfig('[]')).toBeUndefined()
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-page-discovery-'))
    const files = {
      page: join(root, 'pages/home/index.js'),
      component: join(root, 'pages/components/card/index.js'),
    }
    for (const filename of Object.values(files)) {
      await mkdir(dirname(filename), { recursive: true })
      await writeFile(filename, 'export default {}')
    }
    await expect(discoverWebPageIds(root)).resolves.toEqual([])
  })

  it('reports a missing runtime polyfill and relative parent imports', async () => {
    vi.resetModules()
    vi.doMock('node:fs', () => ({ existsSync: () => false }))
    const { resolveRuntimePolyfillPath, toRelativeImport } = await import('../src/plugin/path')
    expect(toRelativeImport('/project/pages/index.ts', '/project/shared.ts')).toBe('../shared.ts')
    expect(() => resolveRuntimePolyfillPath()).toThrow('Failed to resolve runtime polyfill path')
    vi.doUnmock('node:fs')
  })

  it('does not append config module candidates for non-JSON paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-non-json-config-'))
    const filename = join(root, 'config.txt')
    expect(await readJsonFile(filename)).toBeUndefined()
    expect(await resolveJsonPath(filename)).toBeUndefined()
  })
})
