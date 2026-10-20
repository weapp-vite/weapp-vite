import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createVueLanguageService, normalizeFileName } from './languageService'
import { getGeneratedServiceScript } from './serviceScript'

const platformBridge = readFileSync(new URL('./fixtures/template-ref/platform.d.ts', import.meta.url), 'utf8')

function getSourceErrors(source: string, platform = platformBridge) {
  const root = normalizeFileName(fileURLToPath(new URL('./fixtures/template-ref', import.meta.url)))
  const fileName = `${root}/Parent.vue`
  const service = createVueLanguageService(new Map([
    [fileName, source],
    [`${root}/platform.d.ts`, platform],
  ]), {
    lib: 'wevu',
    compilerOptions: { allowJs: true, checkJs: true, skipLibCheck: false, types: [] },
  })
  try {
    return service.getSemanticDiagnostics(fileName)
      .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
      .map(diagnostic => ({
        code: diagnostic.code,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      }))
  }
  finally {
    service.dispose()
  }
}

describe('template ref browser fallback', () => {
  it('keeps SVG tags and the upstream HTML priority for tags present in both maps', () => {
    const source = `<script setup lang="ts">
import { useTemplateRef } from 'wevu'
type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends (<T>() => T extends Right ? 1 : 2) ? true : false
type Assert<T extends true> = T
const divRef = useTemplateRef('divRef')
const anchorRef = useTemplateRef('anchorRef')
const circleRef = useTemplateRef('circleRef')
const divContract: Assert<Equal<typeof divRef.value, HTMLDivElement | null>> = true
const anchorContract: Assert<Equal<typeof anchorRef.value, HTMLAnchorElement | null>> = true
const circleContract: Assert<Equal<typeof circleRef.value, SVGCircleElement | null>> = true
void [divContract, anchorContract, circleContract]
</script>
<template><div ref="divRef" /><a ref="anchorRef" /><svg><circle ref="circleRef" /></svg></template>`
    // 为本例浏览器标签补充 props 表面；ref 目标类型仍由真实 Volar 服务脚本推导。
    const platform = `${platformBridge}
declare module 'wevu/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      a: Record<string, unknown>
      circle: Record<string, unknown>
      div: Record<string, unknown>
      svg: Record<string, unknown>
    }
  }
}`
    expect(getSourceErrors(source, platform)).toEqual([])
  })

  it.each(['jsx', 'tsx'])('keeps the %s service script valid and native refs precise', (lang) => {
    const source = `<script setup lang="${lang}">
import { useTemplateRef } from 'wevu'
const viewRef = useTemplateRef('viewRef')
function onTap() { return viewRef.value?.selector }
</script>
<template><view ref="viewRef" @tap="onTap">{{ onTap() }}</view></template>`
    const { generated, templateReferences } = getGeneratedServiceScript(source)
    const fileName = normalizeFileName(path.resolve(`template-ref-fallback.${lang}`))
    const options: ts.CompilerOptions = { allowJs: true, checkJs: true, noEmit: true, noLib: true, types: [] }
    const host = ts.createCompilerHost(options)
    host.getSourceFile = (name, languageVersion) => normalizeFileName(name) === fileName
      ? ts.createSourceFile(name, generated, languageVersion, true, lang === 'jsx' ? ts.ScriptKind.JSX : ts.ScriptKind.TSX)
      : undefined

    expect(generated).toContain('MiniProgramTemplateRefElements')
    expect(templateReferences).toContain('onTap')
    expect(ts.createProgram([fileName], options, host).getSyntacticDiagnostics()).toEqual([])
    expect(getSourceErrors(source)).toEqual([])
  })
})
