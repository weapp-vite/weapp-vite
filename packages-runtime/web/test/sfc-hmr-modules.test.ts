import type { ModuleNode } from 'vite'
import type { WebDevServer } from '../src/plugin/hostTypes'
import { expect, it, vi } from 'vitest'
import { collectSfcHmrModules } from '../src/plugin/sfcHmr'
import { createEmptyScanState } from '../src/plugin/state'

function moduleNode(id: string | null, importers: ModuleNode[] = []) {
  // 此处只替身 HMR 传播需要的节点身份和反向依赖；真实 Vite 图另由恢复集成用例覆盖。
  return { id, importers: new Set(importers) } as ModuleNode
}

function moduleGraph(files: Array<[string, ModuleNode[]]>): NonNullable<WebDevServer['moduleGraph']> {
  const graph = new Map(files.map(([file, modules]) => [file, new Set(modules)]))
  return {
    getModulesByFile: file => graph.get(file),
    getModuleById: id => [...graph.values()].flatMap(modules => [...modules]).find(module => module.id === id),
    invalidateModule: vi.fn(),
  }
}

it('drops detached template, CSS and file-only roots after deletion while preserving the source owner and other input modules', () => {
  const file = 'src/pages/restored/index.vue'
  const state = createEmptyScanState()
  state.sfcResults.set(file, {})
  const owner = moduleNode(file)
  const template = moduleNode(`${file}?weapp-web-sfc-template`)
  const style = moduleNode(`${file}.css?weapp-web-sfc-style&inline`)
  const fileOnly = moduleNode(null, [style])
  const business = moduleNode('src/store.js')
  const graph = moduleGraph([[file, [owner, template, fileOnly]], [`${file}.css`, [style]]])

  expect(collectSfcHmrModules(state, file, graph, [owner, template, style, fileOnly, business])).toEqual([owner, business])
})

it('keeps template, CSS and file-only propagation paths connected to a live SFC registration', () => {
  const file = 'src/pages/index.vue'
  const state = createEmptyScanState()
  state.sfcResults.set(file, {})
  const owner = moduleNode(file)
  const template = moduleNode(`${file}?weapp-web-sfc-template`, [owner])
  const style = moduleNode(`${file}.css?weapp-web-sfc-style&inline`, [owner])
  const fileOnly = moduleNode(null, [style])
  const graph = moduleGraph([[file, [owner, template, fileOnly]], [`${file}.css`, [style]]])

  expect(collectSfcHmrModules(state, file, graph, [])).toEqual([owner, template, fileOnly, style])
})

it('updates every owner of a shared external block and retains the directly changed module', () => {
  const source = 'src/theme.css'
  const files = ['src/app.vue', 'src/pages/index.vue']
  const state = createEmptyScanState()
  for (const file of files) {
    state.sfcResults.set(file, { meta: { sfcSrcDeps: [source] } })
  }
  const firstOwner = moduleNode(files[0]!)
  const secondOwner = moduleNode(files[1]!)
  const detachedStyle = moduleNode(`${files[0]}.css?weapp-web-sfc-style&inline`)
  const activeStyle = moduleNode(`${files[1]}.css?weapp-web-sfc-style&inline`, [secondOwner])
  const external = moduleNode(source, [detachedStyle, activeStyle])
  const graph = moduleGraph([
    [files[0]!, [firstOwner]],
    [`${files[0]}.css`, [detachedStyle]],
    [files[1]!, [secondOwner]],
    [`${files[1]}.css`, [activeStyle]],
  ])

  expect(collectSfcHmrModules(state, source, graph, [external])).toEqual([external, firstOwner, secondOwner, activeStyle])
})

it('terminates detached cycles and preserves cycles with a path to the owner', () => {
  const file = 'src/pages/index.vue'
  const state = createEmptyScanState()
  state.sfcResults.set(file, {})
  const owner = moduleNode(file)
  const detachedFirst = moduleNode(`${file}?detached-first`)
  const detachedSecond = moduleNode(`${file}?detached-second`, [detachedFirst])
  detachedFirst.importers.add(detachedSecond)
  const activeFirst = moduleNode(`${file}?active-first`)
  const activeSecond = moduleNode(`${file}?active-second`, [activeFirst, owner])
  activeFirst.importers.add(activeSecond)
  const graph = moduleGraph([[file, [owner, detachedFirst, detachedSecond, activeFirst, activeSecond]]])

  expect(collectSfcHmrModules(state, file, graph, [detachedFirst, activeFirst])).toEqual([activeFirst, owner, activeSecond])
})
