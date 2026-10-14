import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_RUNTIME_VIRTUAL_ID } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryModuleCode, createSidecarModuleCode } from './logicalEntry'
import { createSidecarModuleId } from './protocol'

describe('logical entry module source', () => {
  it('shares owner path resolution in one wrapper and observes symlink retargeting in the next wrapper', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'logical-entry-paths-'))
    const first = path.join(root, 'first')
    const second = path.join(root, 'second')
    const alias = path.join(root, 'alias')
    const files = ['page.vue', 'page.json', 'page.css']
    try {
      for (const directory of [first, second]) {
        mkdirSync(directory)
        for (const file of files) {
          writeFileSync(path.join(directory, file), '')
        }
      }
      symlinkSync(first, alias, 'junction')
      const owner = path.join(alias, files[0]!)
      const dependencies = [
        { kind: 'script' as const, sourceId: owner },
        { kind: 'json' as const, sourceId: path.join(alias, files[1]!) },
        { kind: 'style' as const, sourceId: path.join(alias, files[2]!) },
      ]
      const expected = createSidecarModuleId(path.join(first, files[0]!), path.join(first, files[1]!), 'json')
      const native = vi.spyOn(realpathSync, 'native')
      const initial = createLogicalEntryModuleCode({ sourceId: owner, type: 'page' }, dependencies.concat(dependencies))
      expect(initial).toContain(JSON.stringify(expected))
      expect(native.mock.calls.length).toBeLessThanOrEqual(files.length)
      unlinkSync(alias)
      symlinkSync(second, alias, 'junction')
      const next = createLogicalEntryModuleCode({ sourceId: owner, type: 'page' }, dependencies)
      expect(next).not.toContain(JSON.stringify(expected))
      expect(next).toContain(JSON.stringify(createSidecarModuleId(path.join(second, files[0]!), path.join(second, files[1]!), 'json')))
    }
    finally {
      vi.restoreAllMocks()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps equivalent dependency sets stable across discovery order and duplicate edges', () => {
    const entry = { sourceId: '/project/src/app.vue', type: 'app' as const }
    const dependencies = [
      { kind: 'script' as const, sourceId: entry.sourceId },
      { kind: 'json' as const, sourceId: '/project/src/sitemap.json' },
      { kind: 'style' as const, sourceId: '/project/src/app.wxss' },
    ]
    const initial = createLogicalEntryModuleCode(entry, dependencies)
    expect(createLogicalEntryModuleCode(entry, [...dependencies].reverse().concat(dependencies))).toBe(initial)
    expect(createLogicalEntryModuleCode(entry, dependencies.slice(1))).not.toBe(initial)
  })

  it('expresses script and native sidecars as static module dependencies', () => {
    const sourceId = '/project/src/pages/home/index.ts'
    const code = createLogicalEntryModuleCode({ sourceId, type: 'page' }, [
      { kind: 'template', sourceId: '/project/src/pages/home/index.wxml' },
      { kind: 'style', sourceId: '/project/src/pages/home/index.wxss' },
      { kind: 'json', sourceId: '/project/src/pages/home/index.json' },
      { kind: 'wxs', sourceId: '/project/src/pages/home/filter.wxs' },
      { kind: 'layout', sourceId: '/project/src/layouts/default.vue' },
      { kind: 'script', sourceId },
      { kind: 'using-component', sourceId: '/workspace/ui/card/index.ts' },
    ])

    expect(code).toContain(`import ${JSON.stringify(sourceId)};`)
    for (const [kind, dependency] of [
      ['template', '/project/src/pages/home/index.wxml'],
      ['style', '/project/src/pages/home/index.wxss'],
      ['json', '/project/src/pages/home/index.json'],
      ['wxs', '/project/src/pages/home/filter.wxs'],
      ['layout', '/project/src/layouts/default.vue'],
      ['script', sourceId],
      ['using-component', '/workspace/ui/card/index.ts'],
    ] as const) {
      expect(code).toContain(JSON.stringify(createSidecarModuleId(sourceId, dependency, kind)))
    }
    expect(code).toContain(`export * from ${JSON.stringify(sourceId)};`)
  })

  it('forwards page defaults but does not invent an app default export', () => {
    const entry = {
      sourceId: '/project/src/pages/home/index.vue',
      type: 'page' as const,
    }

    expect(createLogicalEntryModuleCode(entry, []))
      .toContain(`export { default } from ${JSON.stringify(entry.sourceId)};`)
    expect(createLogicalEntryModuleCode({
      sourceId: '/project/src/app.vue',
      type: 'app',
    }, [])).not.toContain('export default')
  })

  it('keeps Vue component registration owned by each logical entry', () => {
    const entry = {
      sourceId: '/workspace/node_modules/ui/components/video-preview.vue',
      type: 'component' as const,
    }
    const code = createLogicalEntryModuleCode(entry, [])

    expect(code).toContain('import { createWevuComponent')
    expect(code).toContain(`from ${JSON.stringify(WEAPP_VITE_RUNTIME_VIRTUAL_ID)};`)
    expect(code).not.toContain('from "wevu"')
    expect(code).toContain(`import __weappViteComponentOptions from ${JSON.stringify(entry.sourceId)};`)
    expect(code).toContain('__weappViteCreateWevuComponent(__weappViteComponentOptions);')
    expect(code).toContain('export default __weappViteComponentOptions;')
    expect(code).toContain(`export * from ${JSON.stringify(entry.sourceId)};`)
  })

  it('links sidecar modules to inert source requests', () => {
    expect(createSidecarModuleCode(
      '/project/src/pages/home/index.ts',
      '/project/src/pages/home/index.wxml',
      'template',
    )).toBe('import "/project/src/pages/home/index.wxml?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fpages%2Fhome%2Findex.ts&weapp-vite-sidecar=template&lang.js";\nexport default "/project/src/pages/home/index.wxml";\n')
  })

  it('tracks style sidecars without adding a second CSS contribution', () => {
    expect(createSidecarModuleCode(
      '/project/src/app.ts',
      '/project/src/app.css',
      'style',
    )).toBe('import "/project/src/app.css?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fapp.ts&weapp-vite-sidecar=style&lang.js";\nexport default "/project/src/app.css";\n')
  })
})
