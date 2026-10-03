export const parseCounter = '__weappTemplateAnalysisParseCount'
export type AnalysisVariant = 'shared' | 'duplicate-control'

// 仅在基准构建中恢复 #1058 之前的两次标签分析；其余编译器与依赖完全相同。
const duplicateAnalysis = `function collectTemplateComponentTagInfo(template: string, filename: string, warn?: (message: string) => void): TemplateComponentTagInfo {
  const warnHandler = resolveWarnHandler(warn)
  const autoImportTags = collectVueTemplateTags(template, {
    filename,
    warnLabel: '组件标签',
    warn: (message: string) => warnHandler(message),
    shouldCollect: isAutoImportCandidateTag,
  })
  const templateTags = collectVueTemplateTags(template, {
    filename,
    warnLabel: '脚本导入组件标签',
    warn: (message: string) => warnHandler(message),
    shouldCollect: () => true,
  })
  const componentNames = new Set<string>()
  const tagsByComponentName = new Map<string, Set<string>>()
  for (const tag of templateTags) {
    const camelName = kebabToCamel(tag)
    for (const componentName of [tag, camelName, capitalize(camelName)]) {
      componentNames.add(componentName)
      const matchedTags = tagsByComponentName.get(componentName) ?? new Set<string>()
      matchedTags.add(tag)
      tagsByComponentName.set(componentName, matchedTags)
    }
  }
  return { autoImportTags, componentNames, tagsByComponentName }
}
`

export function createAnalysisControl(source: string) {
  const start = source.indexOf('function collectTemplateComponentTagInfo(')
  const end = source.indexOf('\nexport function collectTemplateComponentNames', start)
  if (start < 0 || end < 0 || !source.slice(start, end).includes('analyzeVueTemplateTags(template)')) {
    throw new Error('Template analysis owner changed; review the duplicate-analysis control before measuring.')
  }
  return source.slice(0, start).replace('import { analyzeVueTemplateTags,', 'import { collectVueTemplateTags, analyzeVueTemplateTags,')
    + duplicateAnalysis + source.slice(end)
}

export function instrumentTemplateParser(source: string) {
  const target = 'const ast = parseTemplate(template, { onError: () => {} })'
  if (source.split(target).length !== 2) {
    throw new Error('Template parser boundary changed; instrumentation cannot establish parse counts.')
  }
  return source.replace(target, `globalThis.${parseCounter} = (globalThis.${parseCounter} ?? 0) + 1\n    ${target}`)
}

export function createTemplateAnalysisInputs() {
  return [10, 100, 1000].map(rows => ({
    filename: `src/pages/analysis-${rows}.vue`,
    source: `<script setup>\nimport Month from 'native/month'\nimport TButton from 'native/button'\nconst title = 'calendar'\nconsole.log(TButton)\n</script>\n<template><view>\n${Array.from({ length: rows }, (_, index) => `<view><text>{{ title }} ${index}</text><scroll-view /><month /><TButton /><t-button /><auto-card /><slot /></view>`).join('\n')}\n</view></template>`,
  }))
}
