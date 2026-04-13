import path from 'node:path'
import vscode from 'vscode'

import {
  APP_JSON_DIAGNOSTIC_SOURCE,
  COMMON_SCRIPT_NAMES,
  DOCS_GENERATE_URL,
  DOCS_GUIDE_URL,
  DOCS_VSCODE_URL,
  PACKAGE_JSON_DIAGNOSTIC_SOURCE,
  PAGE_FILE_DIAGNOSTIC_SOURCE,
  SCRIPT_COMMAND_SUGGESTIONS,
  VUE_JSON_BLOCK_PATTERN,
  WEAPP_VITE_CONFIG_PATTERN,
  WEAPP_VITE_SCRIPT_PATTERN,
} from './constants'
import {
  getAppJsonRouteCompletionContext,
  getAppJsonRouteInsertText,
  getMissingCommonScripts,
} from './logic'

const PAGE_CONFIG_FIELD_DESCRIPTIONS: Record<string, string> = {
  navigationBarTitleText: '设置当前页面的导航栏标题文本。',
  enablePullDownRefresh: '控制当前页面是否启用下拉刷新。',
  backgroundColor: '设置窗口的背景色。',
  backgroundTextStyle: '设置下拉刷新区域的文本样式，可选 dark / light。',
  navigationStyle: '设置导航栏样式，可选 default / custom。',
  disableScroll: '设置页面是否整体禁止滚动。',
}
const DEFINE_PAGE_JSON_BLOCK_PATTERN = /definePageJson\s*\(/u
const DEFINE_PAGE_JSON_OPEN_OBJECT_PATTERN = /(definePageJson\s*\(\s*\{)/u
const JSON_BLOCK_OPEN_OBJECT_PATTERN = /(<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>\s*\{)/u
const PAGE_CONFIG_SYNC_FIELDS = [
  {
    defineFieldPattern: /navigationBarTitleText\s*:\s*'[^']+'/u,
    definePattern: /definePageJson\s*\(\s*\{[\s\S]*?navigationBarTitleText\s*:\s*'([^']+)'/u,
    key: 'navigationBarTitleText',
    label: 'navigationBarTitleText',
    jsonFieldPattern: /"navigationBarTitleText"\s*:\s*"([^"]+)"/u,
    jsonPattern: /<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>[\s\S]*?"navigationBarTitleText"\s*:\s*"([^"]+)"/u,
    valueType: 'string',
  },
  {
    defineFieldPattern: /enablePullDownRefresh\s*:\s*(true|false)/u,
    definePattern: /definePageJson\s*\(\s*\{[\s\S]*?enablePullDownRefresh\s*:\s*(true|false)/u,
    key: 'enablePullDownRefresh',
    label: 'enablePullDownRefresh',
    jsonFieldPattern: /"enablePullDownRefresh"\s*:\s*(true|false)/u,
    jsonPattern: /<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>[\s\S]*?"enablePullDownRefresh"\s*:\s*(true|false)/u,
    valueType: 'boolean',
  },
  {
    defineFieldPattern: /navigationStyle\s*:\s*'[^']+'/u,
    definePattern: /definePageJson\s*\(\s*\{[\s\S]*?navigationStyle\s*:\s*'([^']+)'/u,
    key: 'navigationStyle',
    label: 'navigationStyle',
    jsonFieldPattern: /"navigationStyle"\s*:\s*"([^"]+)"/u,
    jsonPattern: /<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>[\s\S]*?"navigationStyle"\s*:\s*"([^"]+)"/u,
    valueType: 'string',
  },
] as const

function getPageConfigFieldDefinition(field: string) {
  return PAGE_CONFIG_SYNC_FIELDS.find(item => item.key === field) ?? null
}

function escapeSingleQuotedValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}

function escapeJsonStringValue(value: string) {
  return JSON.stringify(value).slice(1, -1)
}

function normalizePageConfigValue(value: string | null, valueType: string) {
  if (value == null) {
    return null
  }

  if (valueType === 'boolean') {
    return value === 'true' ? 'true' : 'false'
  }

  return value
}

function formatDefinePageConfigField(fieldDefinition: NonNullable<ReturnType<typeof getPageConfigFieldDefinition>>, value: string) {
  if (fieldDefinition.valueType === 'boolean') {
    return `${fieldDefinition.key}: ${value}`
  }

  return `${fieldDefinition.key}: '${escapeSingleQuotedValue(value)}'`
}

function formatJsonPageConfigField(fieldDefinition: NonNullable<ReturnType<typeof getPageConfigFieldDefinition>>, value: string) {
  if (fieldDefinition.valueType === 'boolean') {
    return `"${fieldDefinition.key}": ${value}`
  }

  return `"${fieldDefinition.key}": "${escapeJsonStringValue(value)}"`
}

function getPositionFromOffset(text: string, offset: number) {
  const normalizedOffset = Math.max(0, Math.min(offset, text.length))
  const textBeforeOffset = text.slice(0, normalizedOffset)
  const lines = textBeforeOffset.split('\n')
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : ''

  return {
    line: lines.length - 1,
    character: lastLine.length,
  }
}

export function getVuePageConfigConsistencyState(documentText: string, field: string) {
  const fieldDefinition = getPageConfigFieldDefinition(field)

  if (!fieldDefinition) {
    return null
  }

  const hasDefinePageJson = DEFINE_PAGE_JSON_BLOCK_PATTERN.test(documentText)
  const hasJsonBlock = VUE_JSON_BLOCK_PATTERN.test(documentText)
  const definePageJsonMatch = documentText.match(fieldDefinition.definePattern)
  const jsonBlockMatch = documentText.match(fieldDefinition.jsonPattern)

  if (!hasDefinePageJson && !hasJsonBlock) {
    return null
  }

  const definePageJsonValue = normalizePageConfigValue(definePageJsonMatch?.[1] ?? null, fieldDefinition.valueType)
  const jsonBlockValue = normalizePageConfigValue(jsonBlockMatch?.[1] ?? null, fieldDefinition.valueType)
  const matches = Boolean(definePageJsonValue && jsonBlockValue && definePageJsonValue === jsonBlockValue)

  return {
    canSyncDefinePageJsonFromJson: Boolean(hasDefinePageJson && hasJsonBlock && jsonBlockValue && definePageJsonValue !== jsonBlockValue),
    canSyncJsonFromDefinePageJson: Boolean(hasDefinePageJson && hasJsonBlock && definePageJsonValue && definePageJsonValue !== jsonBlockValue),
    definePageJsonValue,
    field: fieldDefinition.key,
    hasDefinePageJson,
    hasJsonBlock,
    jsonBlockValue,
    matches,
  }
}

export function getVuePageTitleConsistencyState(documentText: string) {
  return getVuePageConfigConsistencyState(documentText, 'navigationBarTitleText')
}

export function getJsonBlockSnippet() {
  return [
    '<json lang="jsonc">',
    '{',
    '  "$1": "$2"',
    '}',
    '</json>',
  ].join('\n')
}

export function getDefineConfigTemplate() {
  return [
    'import { defineConfig } from \'weapp-vite\'',
    '',
    'export default defineConfig({',
    '  // https://vite.icebreaker.top/guide/generate.html',
    '})',
  ].join('\n')
}

export function getDefinePageJsonTemplate() {
  return [
    'definePageJson({',
    '  navigationBarTitleText: \'$1\',',
    '})',
  ].join('\n')
}

export function getPageVueTemplate(route: string) {
  const normalizedRoute = route.trim().replace(/^\/+|\/+$/g, '')
  const segments = normalizedRoute.split('/').filter(Boolean)
  const title = segments[segments.length - 2] || segments[segments.length - 1] || 'New Page'

  return [
    '<script setup lang="ts">',
    'definePageJson({',
    `  navigationBarTitleText: '${title}',`,
    '})',
    '</script>',
    '',
    '<template>',
    '  <view class="page">',
    `    ${normalizedRoute}`,
    '  </view>',
    '</template>',
    '',
    '<json lang="jsonc">',
    '{',
    `  "navigationBarTitleText": "${title}"`,
    '}',
    '</json>',
    '',
    '<style scoped>',
    '.page {',
    '  padding: 32rpx;',
    '}',
    '</style>',
    '',
  ].join('\n')
}

export function buildPackageJsonDiagnostics(document: any) {
  const diagnostics = []
  let packageJson

  try {
    packageJson = JSON.parse(document.getText())
  }
  catch {
    return diagnostics
  }

  const dependencyBuckets = [
    packageJson?.dependencies,
    packageJson?.devDependencies,
    packageJson?.peerDependencies,
  ]
  const scripts = typeof packageJson?.scripts === 'object' && packageJson.scripts
    ? packageJson.scripts
    : {}
  const hasWeappViteDependency = dependencyBuckets.some((dependencies) => {
    return Boolean(dependencies?.['weapp-vite'])
  })
  const hasWeappViteScript = Object.values(scripts).some((value) => {
    return typeof value === 'string' && WEAPP_VITE_SCRIPT_PATTERN.test(value)
  })

  if (!hasWeappViteDependency && !hasWeappViteScript) {
    return diagnostics
  }

  const missingScripts = getMissingCommonScripts(packageJson)

  if (missingScripts.length === 0) {
    return diagnostics
  }

  const range = new vscode.Range(0, 0, 0, 1)
  const diagnostic = new vscode.Diagnostic(
    range,
    `建议补齐常用 weapp-vite 脚本：${missingScripts.join(', ')}`,
    vscode.DiagnosticSeverity.Information,
  )
  diagnostic.source = PACKAGE_JSON_DIAGNOSTIC_SOURCE
  diagnostics.push(diagnostic)

  return diagnostics
}

export function buildAppJsonDiagnostics(document: any, missingRoutes: string[]) {
  return missingRoutes.map((route) => {
    const quotedRoute = `"${route}"`
    let targetLine = 0
    let targetCharacter = 0

    for (let line = 0; line < document.lineCount; line++) {
      const lineText = document.lineAt(line).text
      const character = lineText.indexOf(quotedRoute)

      if (character >= 0) {
        targetLine = line
        targetCharacter = character + 1
        break
      }
    }

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(
        targetLine,
        targetCharacter,
        targetLine,
        targetCharacter + route.length,
      ),
      `未找到页面文件：${route}（已尝试 .vue / .ts / .js / .wxml）`,
      vscode.DiagnosticSeverity.Information,
    )

    diagnostic.source = APP_JSON_DIAGNOSTIC_SOURCE
    return diagnostic
  })
}

export function buildVuePageDiagnostics(candidate: { declared: boolean, route: string } | null) {
  if (!candidate || candidate.declared) {
    return []
  }

  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(0, 0, 0, 1),
    `当前页面尚未声明到 app.json：${candidate.route}`,
    vscode.DiagnosticSeverity.Information,
  )

  diagnostic.source = PAGE_FILE_DIAGNOSTIC_SOURCE
  return [diagnostic]
}

export function buildVuePageConfigConsistencyDiagnostics(document: any) {
  const documentText = document.getText()
  const diagnostics = []

  for (const fieldDefinition of PAGE_CONFIG_SYNC_FIELDS) {
    const state = getVuePageConfigConsistencyState(documentText, fieldDefinition.key)

    if (!state || state.matches) {
      continue
    }

    if (state.hasDefinePageJson && state.hasJsonBlock && state.definePageJsonValue && !state.jsonBlockValue) {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `<json> 缺少 ${fieldDefinition.label}，可从 definePageJson 同步。`,
        vscode.DiagnosticSeverity.Information,
      )

      diagnostic.source = PAGE_FILE_DIAGNOSTIC_SOURCE
      diagnostics.push(diagnostic)
      continue
    }

    if (state.hasDefinePageJson && state.hasJsonBlock && !state.definePageJsonValue && state.jsonBlockValue) {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `definePageJson 缺少 ${fieldDefinition.label}，可从 <json> 同步。`,
        vscode.DiagnosticSeverity.Information,
      )

      diagnostic.source = PAGE_FILE_DIAGNOSTIC_SOURCE
      diagnostics.push(diagnostic)
      continue
    }

    const definePageJsonFieldMatch = fieldDefinition.defineFieldPattern.exec(documentText)

    if (!definePageJsonFieldMatch || definePageJsonFieldMatch.index == null) {
      continue
    }

    const start = definePageJsonFieldMatch.index
    const end = start + definePageJsonFieldMatch[0].length
    const startPosition = getPositionFromOffset(documentText, start)
    const endPosition = getPositionFromOffset(documentText, end)
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(
        startPosition.line,
        startPosition.character,
        endPosition.line,
        endPosition.character,
      ),
      `definePageJson 与 <json> 中的 ${fieldDefinition.label} 不一致：'${state.definePageJsonValue}' / '${state.jsonBlockValue}'`,
      vscode.DiagnosticSeverity.Information,
    )

    diagnostic.source = PAGE_FILE_DIAGNOSTIC_SOURCE
    diagnostics.push(diagnostic)
  }

  return diagnostics
}

export function getVuePageConfigDriftFields(documentText: string) {
  const driftFields = []

  for (const fieldDefinition of PAGE_CONFIG_SYNC_FIELDS) {
    const state = getVuePageConfigConsistencyState(documentText, fieldDefinition.key)

    if (!state || state.matches) {
      continue
    }

    if (!state.hasDefinePageJson || !state.hasJsonBlock) {
      continue
    }

    if (!state.definePageJsonValue && !state.jsonBlockValue) {
      continue
    }

    driftFields.push(fieldDefinition.label)
  }

  return driftFields
}

export function getVuePageTextWithSyncedJsonField(documentText: string, field: string) {
  const fieldDefinition = getPageConfigFieldDefinition(field)
  const state = getVuePageConfigConsistencyState(documentText, field)

  if (!fieldDefinition || !state || state.matches || !state.hasJsonBlock || !state.definePageJsonValue) {
    return null
  }

  if (fieldDefinition.jsonFieldPattern.test(documentText)) {
    return documentText.replace(fieldDefinition.jsonFieldPattern, formatJsonPageConfigField(fieldDefinition, state.definePageJsonValue))
  }

  return documentText.replace(JSON_BLOCK_OPEN_OBJECT_PATTERN, `$1\n  ${formatJsonPageConfigField(fieldDefinition, state.definePageJsonValue)},`)
}

export function getVuePageTextWithSyncedJsonFields(documentText: string, fields: string[]) {
  let nextText = documentText
  let changed = false

  for (const field of fields) {
    const syncedText = getVuePageTextWithSyncedJsonField(nextText, field)

    if (!syncedText || syncedText === nextText) {
      continue
    }

    nextText = syncedText
    changed = true
  }

  return changed ? nextText : null
}

export function getVuePageTextWithSyncedJsonTitle(documentText: string) {
  return getVuePageTextWithSyncedJsonField(documentText, 'navigationBarTitleText')
}

export function getVuePageTextWithSyncedDefinePageJsonField(documentText: string, field: string) {
  const fieldDefinition = getPageConfigFieldDefinition(field)
  const state = getVuePageConfigConsistencyState(documentText, field)

  if (!fieldDefinition || !state || state.matches || !state.hasDefinePageJson || !state.jsonBlockValue) {
    return null
  }

  if (fieldDefinition.defineFieldPattern.test(documentText)) {
    return documentText.replace(fieldDefinition.defineFieldPattern, formatDefinePageConfigField(fieldDefinition, state.jsonBlockValue))
  }

  return documentText.replace(DEFINE_PAGE_JSON_OPEN_OBJECT_PATTERN, `$1\n  ${formatDefinePageConfigField(fieldDefinition, state.jsonBlockValue)},`)
}

export function getVuePageTextWithSyncedDefinePageJsonFields(documentText: string, fields: string[]) {
  let nextText = documentText
  let changed = false

  for (const field of fields) {
    const syncedText = getVuePageTextWithSyncedDefinePageJsonField(nextText, field)

    if (!syncedText || syncedText === nextText) {
      continue
    }

    nextText = syncedText
    changed = true
  }

  return changed ? nextText : null
}

export function getVuePageTextWithSyncedDefinePageJsonTitle(documentText: string) {
  return getVuePageTextWithSyncedDefinePageJsonField(documentText, 'navigationBarTitleText')
}

export function getDocItems() {
  return [
    {
      label: '$(book) 打开 weapp-vite 指南',
      description: DOCS_GUIDE_URL,
      url: DOCS_GUIDE_URL,
    },
    {
      label: '$(file-code) 打开 generate 文档',
      description: DOCS_GENERATE_URL,
      url: DOCS_GENERATE_URL,
    },
    {
      label: '$(extensions) 打开 VS Code 扩展目录',
      description: DOCS_VSCODE_URL,
      url: DOCS_VSCODE_URL,
    },
  ]
}

export function getPackageJsonScriptHover(lineText: string) {
  for (const scriptName of COMMON_SCRIPT_NAMES) {
    if (lineText.includes(`"${scriptName}"`)) {
      return new vscode.MarkdownString([
        `**weapp-vite ${scriptName} script**`,
        '',
        `推荐命令：\`${SCRIPT_COMMAND_SUGGESTIONS[scriptName]}\``,
        '',
        `常用于 package.json 的 \`scripts.${scriptName}\`。`,
      ].join('\n'))
    }
  }

  if (WEAPP_VITE_SCRIPT_PATTERN.test(lineText)) {
    return new vscode.MarkdownString([
      '**weapp-vite CLI 脚本**',
      '',
      '当前脚本调用了 `wv` / `weapp-vite`。',
      '',
      `常见组合：\`${SCRIPT_COMMAND_SUGGESTIONS.dev}\`、\`${SCRIPT_COMMAND_SUGGESTIONS.build}\`、\`${SCRIPT_COMMAND_SUGGESTIONS.generate}\`、\`${SCRIPT_COMMAND_SUGGESTIONS.open}\`。`,
    ].join('\n'))
  }

  return null
}

export function getAppJsonRouteHover(
  route: string,
  pageFilePath: string | null,
  candidatePaths: string[],
  workspacePath: string,
) {
  const relativeCandidates = candidatePaths.map(candidate => path.relative(workspacePath, candidate))

  if (pageFilePath) {
    return new vscode.MarkdownString([
      '**app.json 页面路由**',
      '',
      `当前 route：\`${route}\``,
      '',
      `已找到页面文件：\`${path.relative(workspacePath, pageFilePath)}\``,
    ].join('\n'))
  }

  return new vscode.MarkdownString([
    '**app.json 页面路由**',
    '',
    `当前 route：\`${route}\``,
    '',
    '未找到对应页面文件。',
    '',
    `已尝试：${relativeCandidates.map(candidate => `\`${candidate}\``).join('、')}`,
  ].join('\n'))
}

export function getViteConfigHover(wordRangeText: string, lineText: string) {
  if (wordRangeText === 'defineConfig') {
    return new vscode.MarkdownString([
      '**weapp-vite defineConfig**',
      '',
      '用于声明 weapp-vite 的主配置入口。',
      '',
      `参考文档：${DOCS_GUIDE_URL}`,
    ].join('\n'))
  }

  if (wordRangeText === 'generate' || lineText.includes('generate:')) {
    return new vscode.MarkdownString([
      '**generate 配置**',
      '',
      '用于控制小程序配置生成行为。',
      '',
      `参考文档：${DOCS_GENERATE_URL}`,
    ].join('\n'))
  }

  if (wordRangeText === 'weapp' || wordRangeText === 'vite' || WEAPP_VITE_CONFIG_PATTERN.test(lineText)) {
    return new vscode.MarkdownString([
      '**weapp-vite 配置文件**',
      '',
      '当前文件看起来正在声明 weapp-vite 配置。',
      '',
      `项目指南：${DOCS_GUIDE_URL}`,
    ].join('\n'))
  }

  return null
}

export function getVueCustomBlockHover(lineText: string) {
  if (!VUE_JSON_BLOCK_PATTERN.test(lineText)) {
    return null
  }

  return new vscode.MarkdownString([
    '**weapp-vite `<json>` custom block**',
    '',
    '该块通常用于放置页面或组件对应的小程序 JSON 配置。',
    '',
    '建议使用 `lang="jsonc"` 以便保留注释。',
  ].join('\n'))
}

export function getVuePageConfigHover(wordRangeText: string, lineText: string) {
  if (wordRangeText === 'definePageJson' || lineText.includes('definePageJson(')) {
    return new vscode.MarkdownString([
      '**definePageJson 页面配置**',
      '',
      '用于在页面脚本中声明小程序页面配置。',
      '',
      '适合与 `<script setup lang="ts">` 配合使用。',
    ].join('\n'))
  }

  const fieldDescription = PAGE_CONFIG_FIELD_DESCRIPTIONS[wordRangeText]

  if (!fieldDescription) {
    return null
  }

  return new vscode.MarkdownString([
    `**${wordRangeText}**`,
    '',
    fieldDescription,
    '',
    '可用于 `definePageJson({...})` 或页面 `<json>` 配置块。',
  ].join('\n'))
}

export {
  getAppJsonRouteCompletionContext,
  getAppJsonRouteInsertText,
}
