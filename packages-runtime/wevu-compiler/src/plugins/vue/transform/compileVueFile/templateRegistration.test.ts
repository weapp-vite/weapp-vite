import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from './index'

const source = '<script setup>import { ref } from "wevu"; const count = ref(0); function increment() { count.value++ }</script><template><view>{{ count }}</view><button @tap="increment">increment</button></template><style>view { color: red }</style>'
const filename = 'src/pages/template/index.vue'
const signature = async (code: string) => (await compileVueFile(code, filename)).meta?.templateRegistrationSignature

describe('compiled template registration signatures', () => {
  it.each([
    ['script', 'count.value++', 'count.value += 2'],
    ['style', 'color: red', 'color: blue'],
  ])('keeps %s-only edits outside the template registration boundary', async (_kind, previous, current) => {
    expect(await signature(source.replace(previous, current))).toBe(await signature(source))
  })

  it.each([
    ['color replacement', 'py-5.5 bg-[#dbeafe] text-brand'],
    ['utility removal', 'bg-[#fce7f3] text-brand'],
  ])('keeps script setup class %s outside the template registration boundary', async (_kind, utility) => {
    const originalUtility = 'py-5.5 bg-[#fce7f3] text-brand'
    const original = `<script setup>import { ref } from 'wevu'; const count = ref(0); const utility = '${originalUtility}'; function increment() { count.value += 1 }</script><template><view :class="utility">batch utility</view><button @tap="increment">{{ count }}</button></template>`
    const before = await compileVueFile(original, filename)
    const after = await compileVueFile(original.replace(originalUtility, utility), filename)
    expect(after.script).not.toBe(before.script)
    expect(after.template).toBe(before.template)
    expect(before.meta?.templateRegistrationSignature).toEqual(expect.any(String))
    expect(after.meta?.templateRegistrationSignature).toBe(before.meta?.templateRegistrationSignature)
  })

  it.each([
    '<view class="added">static</view>',
    '<view>{{ count * 10 + 1 }}</view><button @tap="count += 2">advance</button>',
  ])('changes the signature for a new compiled template structure: %s', async (inserted) => {
    expect(await signature(source.replace('</template>', `${inserted}</template>`))).not.toBe(await signature(source))
  })

  it('includes resolved external template bytes even when generated binding keys stay the same', async () => {
    const file = path.resolve(filename)
    const external = source.replace(/<template>.*<\/template>/, '<template src="./view.html" />')
    const compile = (template: string) => compileVueFile(external, file, {
      sfcSrc: { readFile: async () => template },
    })
    const before = await compile('<view>{{ count + 1 }}</view>')
    const after = await compile('<view>{{ count + 2 }}</view>')
    expect(before.meta?.sfcSrcCompilationDeps).toEqual(after.meta?.sfcSrcCompilationDeps)
    expect(after.meta?.templateRegistrationSignature).not.toBe(before.meta?.templateRegistrationSignature)
  })

  it('restores both external template output and event script after an A→B→A edit', async () => {
    const file = path.resolve(filename)
    const external = source.replace(/<template>.*<\/template>/, '<template src="./view.html" />')
    const original = '<view>{{ count }}</view><button class="increment" @tap="increment">increment</button>'
    const changed = `<view>{{ count * 10 + 1 }}</view><button class="derived-increment" @tap="count += 2">advance</button>${original}`
    const compile = (template: string) => compileVueFile(external, file, {
      sfcSrc: { readFile: async () => template },
    })
    const before = await compile(original)
    const edited = await compile(changed)
    const restored = await compile(original)
    expect(before.script).toEqual(expect.any(String))
    expect(before.bindingManifest?.features.inlineEvents).toBe(true)
    expect(edited.script).not.toBe(before.script)
    expect(edited.template).not.toBe(before.template)
    expect(restored.script).toBe(before.script)
    expect(restored.template).toBe(before.template)
    expect(restored.meta?.templateRegistrationSignature).toBe(before.meta?.templateRegistrationSignature)
    expect(restored.meta?.sfcSrcCompilationDeps).toEqual(before.meta?.sfcSrcCompilationDeps)
  })

  it('preserves compilation errors instead of producing a fallback signature', async () => {
    await expect(signature(source.replace('const count = ref(0)', 'const = ref(0)'))).rejects.toThrow()
  })
})
