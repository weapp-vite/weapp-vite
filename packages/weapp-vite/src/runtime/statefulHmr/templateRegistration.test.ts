import { afterEach, describe, expect, it, vi } from 'vitest'
import { compileVueFile } from 'wevu/compiler'
import * as realpaths from '../../utils/realpathScope'
import { NativeVueTemplateBaselines, resolveTemplateRegistrationFallback } from './templateRegistration'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('compiled template capability admission', () => {
  const owner = 'src/pages/compiled/index.vue'
  const previous = new Map([[owner, 'compiled-template-before']])

  it('keeps a script or style update with the same compiled registration stateful', () => {
    expect(resolveTemplateRegistrationFallback(previous, {
      entryIds: [owner],
      templateRegistrationSignatures: new Map(previous),
    })).toBeUndefined()
  })

  it('requires classic before a changed inline or external template can be published', () => {
    expect(resolveTemplateRegistrationFallback(previous, {
      entryIds: [owner],
      templateRegistrationSignatures: new Map([[owner, 'compiled-template-after']]),
    })).toMatchObject({ code: 'native-registration', files: [owner] })
    expect(previous.get(owner)).toBe('compiled-template-before')
  })

  it.each([undefined, new Map<string, string | undefined>(), new Map([[owner, undefined]])])('rejects an unknown template contract (%j)', (current) => {
    expect(resolveTemplateRegistrationFallback(previous, { entryIds: [owner], templateRegistrationSignatures: current })?.code).toBe('native-registration')
    expect(resolveTemplateRegistrationFallback(current, { entryIds: [owner], templateRegistrationSignatures: previous })?.code).toBe('native-registration')
  })

  it('leaves independent native WXML and native registration entries outside this boundary', () => {
    expect(resolveTemplateRegistrationFallback(undefined, { entryIds: ['src/pages/native/index.ts'] })).toBeUndefined()
  })

  it.each(['jsx', 'tsx'])('rejects a missing %s compiler registration contract before publishing', (extension) => {
    const entry = `src/pages/compiled/index.${extension}`
    expect(resolveTemplateRegistrationFallback(undefined, { entryIds: [entry] })).toMatchObject({
      code: 'native-registration',
      files: [entry],
    })
    expect(resolveTemplateRegistrationFallback(new Map(), {
      entryIds: [entry],
      templateRegistrationSignatures: new Map([[entry, undefined]]),
    })).toMatchObject({ code: 'native-registration', files: [entry] })
  })

  it('compares frozen snapshots without following mutation of a later compiler generation', () => {
    const live = new Map(previous)
    const frozen = new Map(live)
    live.set(owner, 'a-later-save')
    expect(resolveTemplateRegistrationFallback(previous, { templateRegistrationSignatures: frozen })).toBeUndefined()
    expect(resolveTemplateRegistrationFallback(previous, { templateRegistrationSignatures: live })?.code).toBe('native-registration')
  })

  it('compares Windows lexical registrations and native compiler inputs using the same source identity', () => {
    const lexical = 'C:/workspace/PROJEC~1/src/page.vue'
    const canonical = 'C:/workspace/project-name/src/page.vue'
    const resolve = realpaths.resolveRealpath
    vi.spyOn(realpaths, 'resolveRealpath').mockImplementation(file => file === lexical || file === canonical
      ? canonical.replaceAll('/', '\\')
      : resolve(file))
    for (const [before, after] of [[lexical, canonical], [canonical, lexical]]) {
      const previous = new Map([[before!, 'registered-template']])
      expect(resolveTemplateRegistrationFallback(previous, {
        entryIds: [after!],
        templateRegistrationSignatures: new Map([[after!, 'registered-template']]),
      })).toBeUndefined()
      expect(resolveTemplateRegistrationFallback(previous, {
        entryIds: [after!],
        templateRegistrationSignatures: new Map([[after!, 'changed-template']]),
      })).toMatchObject({ code: 'native-registration', files: [canonical] })
    }
  })
})

describe('published native Vue template input admission', () => {
  const owner = 'src/pages/compiled/index.vue'
  const source = '<script setup>const count = 1</script><template><view>before {{ count }}</view></template><style>view { color: red }</style>'
  const changed = source.replace('before', 'after')

  it('rejects a changed template using the frozen input without consuming its published baseline', () => {
    const baseline = new NativeVueTemplateBaselines()
    baseline.commit(owner, source)
    const live = new Map([[owner, source]])
    const frozen = new Map(live)
    live.set(owner, changed)
    expect(baseline.resolveFallback([owner], frozen)).toBeUndefined()
    expect(baseline.resolveFallback([owner], live)).toMatchObject({ code: 'native-registration', files: [owner] })
    expect(baseline.resolveFallback([owner], live)).toMatchObject({ code: 'native-registration', files: [owner] })
    baseline.commit(owner, changed)
    expect(baseline.resolveFallback([owner], live)).toBeUndefined()
  })

  it('rejects the audit hidden-view append and restoration before preparing a redundant snapshot', async () => {
    const appended = source.replace('</template>', '<view hidden>audit-marker</view>\n</template>')
    const [before, after] = await Promise.all([compileVueFile(source, owner), compileVueFile(appended, owner)])
    expect(before.meta?.templateRegistrationSignature).toEqual(expect.any(String))
    expect(after.meta?.templateRegistrationSignature).toEqual(expect.any(String))
    expect(after.meta?.templateRegistrationSignature).not.toBe(before.meta?.templateRegistrationSignature)
    const baseline = new NativeVueTemplateBaselines()
    baseline.commit(owner, source)
    expect(baseline.resolveFallback([owner], new Map([[owner, appended]])))
      .toMatchObject({ code: 'native-registration', files: [owner] })
    baseline.commit(owner, appended)
    expect(baseline.resolveFallback([owner], new Map([[owner, source]])))
      .toMatchObject({ code: 'native-registration', files: [owner] })
  })

  it.each([
    source,
    source.replace('count = 1', 'count = 2'),
    source.replace('color: red', 'color: blue'),
    changed.replace('count = 1', 'const ='),
    changed.replace('color: red', 'color: '),
    changed.replace('</script>', 'definePageJson({ title: "changed" })</script>'),
    `${changed}<wxs module="probe">module.exports = { value: 1 }</wxs>`,
    source.replace('<template>', '<template lang="pug">'),
    source.replace('<template>', '<template lang="html">').replace('before', 'after'),
    source.replace(/<template>.*<\/template>/, '<template src="./view.html" />'),
  ])('leaves unchanged templates and mixed edits to their existing compilation path', (next) => {
    const baseline = new NativeVueTemplateBaselines()
    baseline.commit(owner, source)
    expect(baseline.resolveFallback([owner], new Map([[owner, next]]))).toBeUndefined()
  })

  it.each([
    source.replace('{{ count }}', '{{ count + 1 }}'),
    source.replace('<view>', '<view v-if="count">'),
    source.replace('<view>', '<view class="changed">'),
    source.replace('<view>', '<text>').replace('</view>', '</text>'),
    source.replace('{{ count }}', '{{ count as number }}'),
  ])('rejects a validated pure template edit before preparing a snapshot', (next) => {
    const baseline = new NativeVueTemplateBaselines()
    baseline.commit(owner, source)
    expect(baseline.resolveFallback([owner], new Map([[owner, next]])))
      .toMatchObject({ code: 'native-registration', files: [owner] })
  })

  it('includes attribute value edits in the registration boundary', () => {
    const baseline = new NativeVueTemplateBaselines()
    const previous = source.replace('<view>', '<view class="before">')
    baseline.commit(owner, previous)
    expect(baseline.resolveFallback([owner], new Map([[owner, previous.replace('class="before"', 'class="after"')]])))
      .toMatchObject({ code: 'native-registration', files: [owner] })
  })

  it('recognizes comment changes while preserving all surrounding template structure', () => {
    const baseline = new NativeVueTemplateBaselines()
    const previous = source.replace('<view>', '<!-- before --><view>')
    baseline.commit(owner, previous)
    expect(baseline.resolveFallback([owner], new Map([[owner, previous.replace('<!-- before -->', '<!-- after -->')]])))
      .toMatchObject({ code: 'native-registration', files: [owner] })
  })

  it.each([
    '<template><view>',
    '<template><view>{{ count. }}</view></template>',
    '<template><view v-if="count.">changed</view></template>',
    '<template><view v-for="item in list.">changed</view></template>',
    '<template><view @tap="const = 1">changed</view></template>',
    '<template><view v-else>changed</view></template>',
    '<template><input v-model="count + 1" /></template>',
  ])('does not convert invalid template syntax into a capability fallback (%s)', (template) => {
    const baseline = new NativeVueTemplateBaselines()
    baseline.commit(owner, source)
    const next = `<script setup>const count = 1</script>${template}<style>view { color: red }</style>`
    expect(baseline.resolveFallback([owner], new Map([[owner, next]]))).toBeUndefined()
  })

  it('does not invent or retain a comparison baseline for unpublished or cleared inputs', () => {
    const baseline = new NativeVueTemplateBaselines()
    expect(baseline.has(owner)).toBe(false)
    expect(baseline.resolveFallback([owner], new Map([[owner, changed]]))).toBeUndefined()
    baseline.commit(owner, source)
    expect(baseline.has(owner)).toBe(true)
    baseline.clear()
    expect(baseline.has(owner)).toBe(false)
    expect(baseline.resolveFallback([owner], new Map([[owner, changed]]))).toBeUndefined()
  })
})
