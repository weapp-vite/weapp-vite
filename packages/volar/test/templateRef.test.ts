import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createVueLanguageService, findOffset, normalizeFileName } from './languageService'
import { getGeneratedServiceScript } from './serviceScript'

const platformBridge = readFileSync(new URL('./fixtures/template-ref/platform.d.ts', import.meta.url), 'utf8')

const typeAssertions = `type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends (<T>() => T extends Right ? 1 : 2) ? true : false
type Assert<T extends true> = T`

function createRefService(source: string, lib = 'wevu', extraFiles = new Map<string, string>()) {
  const root = normalizeFileName(fileURLToPath(new URL('./fixtures/template-ref', import.meta.url)))
  const fileName = `${root}/Parent.vue`
  const files = new Map([
    [fileName, source],
    ...(lib === 'wevu' ? [[`${root}/platform.d.ts`, platformBridge] as const] : []),
    ...[...extraFiles].map(([file, content]) => [`${root}/${file}`, content] as const),
  ])
  const service = createVueLanguageService(files, {
    lib,
    compilerOptions: { allowJs: true, checkJs: true, skipLibCheck: false, types: [] },
  })
  return { fileName, root, service }
}

function serviceScriptSyntaxErrors(source: string, lang: string) {
  const fileName = normalizeFileName(path.resolve(`template-ref-service.${lang}`))
  const options: ts.CompilerOptions = { allowJs: true, checkJs: true, noEmit: true, noLib: true, types: [] }
  const host = ts.createCompilerHost(options)
  host.getSourceFile = (name, languageVersion) => normalizeFileName(name) === fileName
    ? ts.createSourceFile(name, source, languageVersion, true, lang === 'js' ? ts.ScriptKind.JS : ts.ScriptKind.TS)
    : undefined
  return ts.createProgram([fileName], options, host).getSyntacticDiagnostics()
}

function errors(service: ts.LanguageService, fileName: string) {
  // 本层验证 SFC 自身推导；发布依赖图和 SDK/DOM 冲突由普通 npm 严格编译单独验收。
  return service.getSemanticDiagnostics(fileName)
    .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
    .map(diagnostic => ({
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      start: diagnostic.start,
    }))
}

describe('mini-program template ref type isolation', () => {
  it('infers native view/map refs, repeated refs, explicit generics and exposed component methods from real SFCs', () => {
    const source = readFileSync(new URL('./fixtures/template-ref/Parent.vue', import.meta.url), 'utf8')
    const child = readFileSync(new URL('./fixtures/template-ref/Child.vue', import.meta.url), 'utf8')
    const { fileName, service } = createRefService(source, 'wevu', new Map([['Child.vue', child]]))
    try {
      expect(errors(service, fileName)).toEqual([])
    }
    finally {
      service.dispose()
    }
  })

  it('reports native DOM-only access and unexposed component methods at their original SFC positions', () => {
    const source = `<script setup lang="ts">
import { useTemplateRef } from 'wevu'
import Child from './Child.vue'
const viewRef = useTemplateRef('viewRef')
const childRef = useTemplateRef('childRef')
viewRef.value?.getAttribute('id')
childRef.value?.hidden()
</script>
<template><view ref="viewRef" /><Child ref="childRef" /></template>`
    const child = `<script setup lang="ts">
function open() { return 1 }
function hidden() { return 2 }
defineExpose({ open })
void hidden
</script>
<template><view /></template>`
    const { fileName, service } = createRefService(source, 'wevu', new Map([['Child.vue', child]]))
    try {
      const diagnostics = errors(service, fileName)
      expect(diagnostics).toHaveLength(2)
      expect(diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 2339, start: findOffset(source, 'getAttribute') }),
        expect.objectContaining({ code: 2339, start: findOffset(source, 'hidden()') }),
      ]))
    }
    finally {
      service.dispose()
    }
  })

  it('keeps browser map refs as HTMLMapElement when the plugin is installed with lib=vue', () => {
    const source = `<script setup lang="ts">
import { useTemplateRef } from 'vue'
${typeAssertions}
const mapRef = useTemplateRef('mapRef')
const contract: Assert<Equal<typeof mapRef.value, HTMLMapElement | null>> = true
void contract
</script>
<template><map ref="mapRef" /></template>`
    const { fileName, service } = createRefService(source, 'vue')
    try {
      expect(errors(service, fileName)).toEqual([])
      expect(getGeneratedServiceScript(source, false, 'vue').generated).not.toContain('MiniProgramTemplateRefElements')
    }
    finally {
      service.dispose()
    }
  })

  it.each(['ts', 'js'])('keeps the %s service script syntax and template source mappings while binding its local element map', (lang) => {
    const source = `<script setup lang="${lang}">
import { useTemplateRef } from 'wevu'
const viewRef = useTemplateRef('viewRef')
function onTap() { return viewRef.value?.selector }
</script>
<template><view ref="viewRef" @tap="onTap">{{ onTap() }}</view></template>`
    const { generated, templateReferences } = getGeneratedServiceScript(source)
    expect(generated).toContain('MiniProgramTemplateRefElements')
    expect(templateReferences).toContain('onTap')
    expect(serviceScriptSyntaxErrors(generated, lang)).toEqual([])
    const { fileName, service } = createRefService(source)
    try {
      const virtualSource = service.getProgram()!.getSourceFile(fileName)!
      expect(Boolean(virtualSource.flags & ts.NodeFlags.JavaScriptFile)).toBe(lang === 'js')
      expect(service.getSyntacticDiagnostics(fileName)).toEqual([])
      expect(errors(service, fileName)).toEqual([])
    }
    finally {
      service.dispose()
    }
  })

  it('does not merge native template elements into the consumer DOM map when importing wevu', () => {
    const source = `import type { TemplateRefValue } from 'wevu'
${typeAssertions}
type NoNativeView = Assert<Equal<'view' extends keyof HTMLElementTagNameMap ? true : false, false>>
type BrowserMap = Assert<Equal<HTMLElementTagNameMap['map'], HTMLMapElement>>
type EveryBrowserTagIsAnElement = Assert<HTMLElementTagNameMap[keyof HTMLElementTagNameMap] extends Element ? true : false>
export type Contracts = [NoNativeView, BrowserMap, EveryBrowserTagIsAnElement, TemplateRefValue]`
    const { root, service } = createRefService('<template><view /></template>', 'wevu', new Map([['consumer.ts', source]]))
    try {
      expect(errors(service, `${root}/consumer.ts`)).toEqual([])
    }
    finally {
      service.dispose()
    }
  })
})
