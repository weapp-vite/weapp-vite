import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { createLogicalEntryModuleCode, createSidecarModuleCode } from '../../moduleGraph/logicalEntry'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier, parseSidecarModuleId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { isSafeJavaScriptPatch, isStatefulHmrBoundary } from './session'
import { createStatefulHmrSidecarModuleCode } from './sidecarPlugin'

describe('native component HMR dependency boundaries', () => {
  it('accepts a registered native component digest without changing the parent component mapping', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'stateful-component-graph-'))
    const page = path.join(root, 'page.js')
    const component = path.join(root, 'counter.js')
    const entryIds = new Set([page, component])
    const mapping = createSidecarModuleId(page, component, 'using-component')
    const token = createSidecarSourceSpecifier(page, component, 'using-component')
    const accepted = new Set<string>()
    const parentEntry = createLogicalEntryId(page, 'page')
    const componentEntry = createLogicalEntryId(component, 'component')
    const sources = new Map([
      [page, 'Page({ data: { title: "parent" } });'],
      [component, 'Component({ methods: { increment() { return 2; } } });'],
      [parentEntry, createLogicalEntryModuleCode({ sourceId: page, type: 'page' }, [{ kind: 'using-component', sourceId: component }])],
      [componentEntry, createLogicalEntryModuleCode({ sourceId: component, type: 'component' }, [{ kind: 'script', sourceId: component }])],
    ])
    let graph: { parentImports: string[], tokenImports: string[], componentImports: string[] } | undefined
    try {
      const bundle = await rolldown({
        input: { page: parentEntry, counter: componentEntry },
        plugins: [{
          name: 'native-component-graph-fixture',
          resolveId(id) {
            return { id, moduleSideEffects: 'no-treeshake' }
          },
          load(id) {
            const sidecar = parseSidecarModuleId(id)
            if (sidecar) {
              return createSidecarModuleCode(sidecar.ownerId, sidecar.sourceId, sidecar.kind)
            }
            const raw = parseSidecarSourceRequest(id)
            return raw ? createStatefulHmrSidecarModuleCode(id, sources.get(raw.sourceId)!) : sources.get(id)
          },
          transform(code, id) {
            if (isStatefulHmrBoundary(id, root, entryIds)) {
              accepted.add(id)
              return `${code}\nif (import.meta.hot) import.meta.hot.accept();`
            }
          },
          generateBundle() {
            graph = {
              parentImports: this.getModuleInfo(parentEntry)!.importedIds,
              tokenImports: this.getModuleInfo(mapping)!.importedIds,
              componentImports: this.getModuleInfo(componentEntry)!.importedIds,
            }
          },
        }],
      })
      try {
        await bundle.generate({ format: 'es' })
      }
      finally {
        await bundle.close()
      }
      expect(graph!.parentImports).toContain(mapping)
      expect(graph!.tokenImports).toContain(token)
      expect(graph!.componentImports).toContain(component)
      expect(accepted.has(component)).toBe(true)
      expect(accepted.has(token)).toBe(true)
      expect(accepted.has(parentEntry)).toBe(false)
    }
    finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it('accepts only matching native component tokens from known executable entries', () => {
    const root = '/project'
    const component = '/project/src/counter.js'
    const owner = '/project/src/page.js'
    const options = { root, entryIds: new Set([component, owner]) }
    const token = createSidecarSourceSpecifier(owner, 'src/counter.js', 'using-component')
    const patch = { type: 'Patch' as const, code: 'updated();', filename: 'update.js', changedIds: [token] }
    expect(isSafeJavaScriptPatch([component], patch, [], options)).toBe(true)
    expect(isSafeJavaScriptPatch([component], patch, [], { ...options, srcRoot: '/project/other-source' })).toBe(false)
    expect(isSafeJavaScriptPatch([component], patch, [], { ...options, entryIds: new Set([owner]) })).toBe(false)
    expect(isSafeJavaScriptPatch([owner], patch, [], options)).toBe(false)
    expect(isSafeJavaScriptPatch([component], patch)).toBe(false)
    expect(isSafeJavaScriptPatch([component], patch, ['entry-mixed-config:1'], options)).toBe(false)
    expect(isSafeJavaScriptPatch([component], { type: 'FullReload', reason: 'unaccepted dependency' }, [], options)).toBe(false)
    for (const kind of ['json', 'template', 'layout'] as const) {
      expect(isSafeJavaScriptPatch([component], { ...patch, changedIds: [createSidecarSourceSpecifier(owner, component, kind)] }, [], options)).toBe(false)
    }
    for (const source of ['/project/src/unknown.js', '/project/src/counter.vue', '/project/src/counter.tsx', '/project/src/counter.json']) {
      const sourceToken = createSidecarSourceSpecifier(owner, source, 'using-component')
      expect(isStatefulHmrBoundary(sourceToken, '/project/src', options.entryIds)).toBe(false)
      expect(isSafeJavaScriptPatch([source], { ...patch, changedIds: [sourceToken] }, [], options)).toBe(false)
    }
    const vue = '/project/src/counter.vue'
    expect(isStatefulHmrBoundary(createSidecarSourceSpecifier(owner, vue, 'using-component'), '/project/src', [vue])).toBe(false)
  })
})
