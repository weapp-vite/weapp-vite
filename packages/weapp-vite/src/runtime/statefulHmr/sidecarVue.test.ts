import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { createLogicalEntryModuleCode, createSidecarModuleCode } from '../../moduleGraph/logicalEntry'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier, parseSidecarModuleId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { isSafeJavaScriptPatch, isStatefulHmrBoundary } from './session'
import { createStatefulHmrSidecarModuleCode } from './sidecarPlugin'

const source = `<script>export default { methods: { increment() { return 1 } } }</script>
<template><view class="counter">{{ count }}</view></template>
<style>.counter { color: red; }</style>
<json>{ "component": true, "styleIsolation": "isolated" }</json>`

describe('Vue component dependency digests', () => {
  const component = '/project/src/counter.vue'
  const owner = '/project/src/page.js'
  const token = createSidecarSourceSpecifier(owner, component, 'using-component')

  it.each([
    source,
    source.replace('<script>export default { methods: { increment() { return 1 } } }</script>', '<script setup>const count = 1</script>'),
  ])('leaves component script execution to its own accepted entry', (initial) => {
    expect(createStatefulHmrSidecarModuleCode(token, initial.replace('1', '2'))).toBe(
      createStatefulHmrSidecarModuleCode(token, initial),
    )
    const script = createSidecarSourceSpecifier(component, component, 'script')
    expect(createStatefulHmrSidecarModuleCode(script, initial.replace('1', '2'))).not.toBe(
      createStatefulHmrSidecarModuleCode(script, initial),
    )
  })

  it.each([
    ['template', '{{ count }}', 'changed {{ count }}'],
    ['style', 'color: red', 'color: blue'],
    ['config', 'isolated', 'shared'],
    ['custom block', '</json>', '</json><wxs module="value">module.exports = 2</wxs>'],
  ])('keeps %s and mixed script changes outside the JavaScript boundary', (_, before, after) => {
    const initial = createStatefulHmrSidecarModuleCode(token, source)
    const changed = source.replace(before, after)
    expect(createStatefulHmrSidecarModuleCode(token, changed)).not.toBe(initial)
    expect(createStatefulHmrSidecarModuleCode(token, changed.replace('return 1', 'return 2'))).not.toBe(initial)
    expect(isStatefulHmrBoundary(token, '/project/src', [owner, component])).toBe(false)
    expect(isSafeJavaScriptPatch([component], {
      type: 'Patch',
      code: 'void 0',
      filename: 'update.js',
      changedIds: [token],
    }, [], { root: '/project', srcRoot: '/project/src', entryIds: [owner, component] })).toBe(false)
  })

  it('keeps JSON macro configuration changes in the parent dependency', () => {
    const initial = source.replace('<script>', '<script>defineComponentJson({ styleIsolation: "isolated" });')
    const scriptOnly = initial.replace('return 1', 'return 2')
    const configOnly = initial.replace('styleIsolation: "isolated"', 'styleIsolation: "shared"')
    expect(createStatefulHmrSidecarModuleCode(token, scriptOnly)).toBe(createStatefulHmrSidecarModuleCode(token, initial))
    expect(createStatefulHmrSidecarModuleCode(token, configOnly)).not.toBe(createStatefulHmrSidecarModuleCode(token, initial))
    expect(createStatefulHmrSidecarModuleCode(token, configOnly.replace('return 1', 'return 2'))).not.toBe(createStatefulHmrSidecarModuleCode(token, initial))
  })

  it('falls back to the full source for malformed SFC input', () => {
    const malformed = '<template><view>first</view></template'
    expect(createStatefulHmrSidecarModuleCode(token, malformed.replace('first', 'second'))).not.toBe(
      createStatefulHmrSidecarModuleCode(token, malformed),
    )
  })

  it('retains unaccepted parent graph edges only when non-script component blocks change', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'stateful-vue-component-graph-'))
    const page = path.join(root, 'page.js')
    const child = path.join(root, 'counter.vue')
    const entryIds = new Set([page, child])
    const delegatedComponentEntryIds = new Set([child])
    const parentEntry = createLogicalEntryId(page, 'page')
    const childEntry = createLogicalEntryId(child, 'component')
    const mapping = createSidecarModuleId(page, child, 'using-component')
    const digestId = createSidecarSourceSpecifier(page, child, 'using-component')
    const sources = new Map([
      [page, 'Page({ data: { count: 0 } });'],
      [parentEntry, createLogicalEntryModuleCode({ sourceId: page, type: 'page' }, [{ kind: 'using-component', sourceId: child }])],
      [childEntry, createLogicalEntryModuleCode({ sourceId: child, type: 'component' }, [{ kind: 'script', sourceId: child }])],
    ])
    const buildGraph = async (sfc: string) => {
      const codes = new Map<string, string>()
      const accepted = new Set<string>()
      const edges = new Map<string, string[]>()
      const bundle = await rolldown({
        input: { page: parentEntry, counter: childEntry },
        plugins: [{
          name: 'vue-component-graph-fixture',
          resolveId: id => ({ id, external: id === 'wevu', moduleSideEffects: 'no-treeshake' }),
          load(id) {
            const sidecar = parseSidecarModuleId(id)
            if (sidecar) {
              return createSidecarModuleCode(sidecar.ownerId, sidecar.sourceId, sidecar.kind)
            }
            const raw = parseSidecarSourceRequest(id)
            return raw
              ? createStatefulHmrSidecarModuleCode(id, sfc)
              : id === child ? parse(sfc).descriptor.script!.content : sources.get(id)
          },
          transform(code, id) {
            codes.set(id, code)
            if (isStatefulHmrBoundary(id, root, entryIds, delegatedComponentEntryIds)) {
              accepted.add(id)
              return `${code}\nif (import.meta.hot) import.meta.hot.accept();`
            }
          },
          generateBundle() {
            for (const id of [parentEntry, mapping, childEntry]) {
              edges.set(id, this.getModuleInfo(id)!.importedIds)
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
      return { codes, accepted, edges }
    }
    try {
      const initial = await buildGraph(source)
      const script = await buildGraph(source.replace('return 1', 'return 2'))
      const template = await buildGraph(source.replace('{{ count }}', 'changed {{ count }}'))
      expect(initial.edges.get(parentEntry)).toContain(mapping)
      expect(initial.edges.get(mapping)).toContain(digestId)
      expect(initial.edges.get(childEntry)).toContain(child)
      expect(script.codes.get(digestId)).toBe(initial.codes.get(digestId))
      expect(script.codes.get(child)).not.toBe(initial.codes.get(child))
      expect(script.accepted.has(child)).toBe(false)
      expect(script.accepted.has(childEntry)).toBe(true)
      expect(template.codes.get(digestId)).not.toBe(initial.codes.get(digestId))
      expect(template.accepted.has(digestId)).toBe(false)
      expect(template.accepted.has(parentEntry)).toBe(false)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
