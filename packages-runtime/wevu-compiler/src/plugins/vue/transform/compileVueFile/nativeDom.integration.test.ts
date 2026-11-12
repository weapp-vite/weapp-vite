import type { NativeDomNode } from '@weapp-core/shared/native-dom'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { WEAPP_VITE_RUNTIME_VIRTUAL_IDS } from '@weapp-core/constants'
import { rolldown } from 'rolldown'
import { afterEach, expect, it, vi } from 'vitest'
import { FakeNode } from '../../../../../../wevu/src/nativeDom/fake.testHelper'
import { getMiniProgramTemplatePlatform } from '../../compiler/template'
import { compileVueFile } from './index'

const runtimeRoot = fileURLToPath(new URL('../../../../../../wevu/src/', import.meta.url))
let directory: string | undefined

afterEach(async () => {
  vi.unstubAllGlobals()
  if (directory) {
    await rm(directory, { recursive: true, force: true })
  }
})

it('将完整 SFC 编译为 ESM 并在 TT 文档执行条件、列表、组件、事件和卸载', async () => {
  const sources = {
    'page.vue': `<script>
import { ref, nextTick } from 'wevu'
import Child from './Child.vue'
export { nextTick }
export const rows = ref([1, 2, 3])
export const visible = ref(true)
export const style = ref({ color: 'red' })
export const model = ref('initial')
export const picked = ref('')
export let setupRuns = 0
export default { components: { Child }, setup() { setupRuns++; return { rows, visible, style, model, picked } } }
</script><template><view :style="style"><Child v-for="row in rows" :key="row" :label="row" v-model="model" @pick="picked = $event.detail"><text v-if="visible">slot</text></Child><input v-model="model"/><native-input v-model="model"/><button @tap.capture="visible = !visible">toggle</button></view></template>`,
    'Child.vue': `<script setup lang="ts">defineProps<{ label: number }>(); const emit = defineEmits<{ pick: [value: number] }>(); const model = defineModel<string>()</script><template><view @tap="emit('pick', label); model = 'child'"><text>{{ label }}</text><slot/><native-card :value="label"/></view></template>`,
  }
  const scripts = new Map<string, string>()
  for (const [filename, source] of Object.entries(sources)) {
    const result = await compileVueFile(source, filename, {
      renderer: 'auto',
      isPage: filename === 'page.vue',
      skipComponentTransform: filename !== 'page.vue',
      template: { platform: getMiniProgramTemplatePlatform('tt') },
    })
    scripts.set(filename, result.script!)
  }
  directory = await mkdtemp(path.join(os.tmpdir(), 'wevu-native-dom-'))
  const bundle = await rolldown({
    input: 'page.vue',
    tsconfig: false,
    transform: { define: { 'process.env.NODE_ENV': '"production"', '__VUE_OPTIONS_API__': 'true', '__VUE_PROD_DEVTOOLS__': 'false' } },
    plugins: [{
      name: 'compiled-sfc-test',
      resolveId(source) {
        if (scripts.has(source.replace('./', ''))) {
          return `\0fixture:${source.replace('./', '')}`
        }
        if (source === 'wevu' || source === 'wevu/internal-runtime' || source === WEAPP_VITE_RUNTIME_VIRTUAL_IDS.runtime) {
          return path.join(runtimeRoot, 'internal-runtime.ts')
        }
        if (source === 'wevu/internal-reactivity' || source === WEAPP_VITE_RUNTIME_VIRTUAL_IDS.reactivity) {
          return path.join(runtimeRoot, 'internal-reactivity.ts')
        }
        if (source === WEAPP_VITE_RUNTIME_VIRTUAL_IDS.template) {
          return path.join(runtimeRoot, 'internal-template.ts')
        }
        if (source === 'wevu/native-dom') {
          return path.join(runtimeRoot, 'nativeDom/index.ts')
        }
      },
      load(id) {
        if (id.startsWith('\0fixture:')) {
          return scripts.get(id.slice('\0fixture:'.length))
        }
      },
    }],
  })
  const output = path.join(directory, 'page.mjs')
  try {
    await bundle.write({ file: output, format: 'esm', codeSplitting: false })
  }
  finally {
    await bundle.close()
  }
  const container = new FakeNode('#document')
  const Component = vi.fn()
  vi.stubGlobal('Component', Component)
  vi.stubGlobal('tt', {
    getRenderMode: () => 2,
    appDocument: {
      createElement: (type: string) => new FakeNode(type),
      createNativeComponent: (type: string) => new FakeNode(type),
      createTextNode: (text: string) => Object.assign(new FakeNode('#text'), { nodeValue: text }),
      getPageDocumentById: () => container as unknown as NativeDomNode,
    },
  })
  const module = await import(/* @vite-ignore */ pathToFileURL(output).href)
  const definition = Component.mock.lastCall![0] as Record<string, any>
  const host = { __webviewId__: 42, data: { ...definition.data }, properties: {}, setData: vi.fn() }
  definition.lifetimes.created.call(host)
  definition.lifetimes.attached.call(host)
  definition.onLoad.call(host, {})
  const readText = (node: FakeNode): string => node.nodeValue ?? node.children.map(readText).join('')
  expect(readText(container)).toBe('1slot2slot3slottoggle')
  module.rows.value = [3, 1, 4]
  module.style.value = {}
  await module.nextTick()
  expect(readText(container)).toBe('3slot1slot4slottoggle')
  const root = container.children[0]!
  expect(root.attributes.has('style')).toBe(false)
  const button = root.children.find(node => node.name === 'button')!
  button.dispatch('bindtap')
  await module.nextTick()
  expect(readText(container)).toBe('314toggle')
  const child = root.children.find(node => node.name === 'view')!
  child.dispatch('bindtap')
  expect(module.picked.value).toBe(3)
  expect(module.model.value).toBe('child')
  await module.nextTick()
  const input = root.children.find(node => node.name === 'input')!
  expect(input.attributes.get('value')).toBe('child')
  input.dispatch('bindinput')
  await module.nextTick()
  expect(module.model.value).toBe('from-native')
  const nativeInput = root.children.find(node => node.name === 'native-input')!
  expect(nativeInput.attributes.get('modelValue')).toBe('from-native')
  nativeInput.dispatch('bindupdate-modelvalue')
  await module.nextTick()
  expect(module.model.value).toEqual({ value: 'from-native' })
  expect(host.setData).not.toHaveBeenCalled()
  definition.onUnload.call(host)
  expect(container.children).toEqual([])
  expect(button.listeners.size).toBe(0)
  expect(module.setupRuns).toBe(1)
  vi.stubGlobal('tt', {})
  const fallback = { ...host, data: { ...definition.data }, setData: vi.fn() }
  definition.lifetimes.created.call(fallback)
  definition.lifetimes.attached.call(fallback)
  definition.onLoad.call(fallback, {})
  expect(module.setupRuns).toBe(2)
  expect(fallback.setData).toHaveBeenCalledWith({ __wevuLegacyRenderer: true })
  definition.onUnload.call(fallback)
})
