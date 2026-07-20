import type { QuickAppVueCompileResult } from './types'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'
import { QUICKAPP_VUE_RUNTIME_FILE } from './runtime'
import { compileQuickAppVueScript } from './script'
import { compileQuickAppVueTemplate } from './template'

function createRuntimeRequest(filename: string, srcDir: string) {
  const outputFile = filename.replace(/\.vue$/, '.ux')
  const request = path.relative(path.dirname(outputFile), path.resolve(srcDir, QUICKAPP_VUE_RUNTIME_FILE))
    .replaceAll('\\', '/')
  return request.startsWith('.') ? request : `./${request}`
}

function renderStyles(styles: ReturnType<typeof parse>['descriptor']['styles']) {
  if (styles.length === 0) {
    return ''
  }
  const languages = new Set(styles.map(style => style.lang ?? 'css'))
  if (languages.size > 1) {
    throw new Error('QuickApp Vue 编译暂不支持在同一 SFC 中混用多种 style lang。')
  }
  const lang = styles[0].lang
  const attribute = lang ? ` lang="${lang}"` : ''
  return `<style${attribute}>\n${styles.map(style => style.content).join('\n')}\n</style>`
}

export async function compileQuickAppVueFile(
  source: string,
  filename: string,
  srcDir: string,
): Promise<QuickAppVueCompileResult> {
  const parsed = parse(source, { filename })
  if (parsed.errors.length > 0) {
    throw parsed.errors[0]
  }
  const { descriptor } = parsed
  const script = await compileQuickAppVueScript(
    descriptor,
    filename,
    createRuntimeRequest(filename, srcDir),
  )
  const compiledTemplate = descriptor.template
    ? compileQuickAppVueTemplate(descriptor.template.content, script.components)
    : undefined
  const template = compiledTemplate
    ? [compiledTemplate.imports, `<template>\n${compiledTemplate.content}\n</template>`].filter(Boolean).join('\n')
    : ''
  const style = renderStyles(descriptor.styles)
  return {
    components: script.components,
    code: [template, `<script>\n${script.code}\n</script>`, style].filter(Boolean).join('\n\n'),
  }
}

export { QUICKAPP_VUE_RUNTIME_FILE, quickAppVueRuntimeSource } from './runtime'
