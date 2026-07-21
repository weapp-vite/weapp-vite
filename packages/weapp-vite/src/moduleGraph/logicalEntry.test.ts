import { describe, expect, it } from 'vitest'
import { createLogicalEntryModuleCode, createSidecarModuleCode } from './logicalEntry'
import { createSidecarModuleId } from './protocol'

describe('logical entry module source', () => {
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

  it('links sidecar modules to inert source requests', () => {
    expect(createSidecarModuleCode(
      '/project/src/pages/home/index.ts',
      '/project/src/pages/home/index.wxml',
      'template',
    )).toBe('import "/project/src/pages/home/index.wxml?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fpages%2Fhome%2Findex.ts&weapp-vite-sidecar=template&lang.js";\nexport default "/project/src/pages/home/index.wxml";\n')
  })

  it('links style sidecars through the native CSS pipeline', () => {
    expect(createSidecarModuleCode(
      '/project/src/app.ts',
      '/project/src/app.css',
      'style',
    )).toBe('import "/project/src/app.css?weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fapp.ts&weapp-vite-sidecar=style&lang.css";\nexport default "/project/src/app.css";\n')
  })
})
