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
const DEFINE_PAGE_JSON_TITLE_PATTERN = /definePageJson\s*\(\s*\{[\s\S]*?navigationBarTitleText\s*:\s*'([^']+)'/u
const JSON_BLOCK_TITLE_PATTERN = /<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>[\s\S]*?"navigationBarTitleText"\s*:\s*"([^"]+)"/u
const DEFINE_PAGE_JSON_TITLE_FIELD_PATTERN = /navigationBarTitleText\s*:\s*'[^']+'/u

function getPositionFromOffset(text: string, offset: number) {
  const normalizedOffset = Math.max(0, Math.min(offset, text.length))
  const textBeforeOffset = text.slice(0, normalizedOffset)
  const lines = textBeforeOffset.split('\n')

  return {
    line: lines.length - 1,
    character: lines.at(-1)?.length ?? 0,
  }
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
  const title = normalizedRoute.split('/').filter(Boolean).at(-2) || normalizedRoute.split('/').filter(Boolean).at(-1) || 'New Page'

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
  const definePageJsonMatch = documentText.match(DEFINE_PAGE_JSON_TITLE_PATTERN)
  const jsonBlockMatch = documentText.match(JSON_BLOCK_TITLE_PATTERN)

  if (!definePageJsonMatch || !jsonBlockMatch) {
    return []
  }

  if (definePageJsonMatch[1] === jsonBlockMatch[1]) {
    return []
  }

  const definePageJsonFieldMatch = DEFINE_PAGE_JSON_TITLE_FIELD_PATTERN.exec(documentText)

  if (!definePageJsonFieldMatch || definePageJsonFieldMatch.index == null) {
    return []
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
    `definePageJson 与 <json> 中的 navigationBarTitleText 不一致：'${definePageJsonMatch[1]}' / '${jsonBlockMatch[1]}'`,
    vscode.DiagnosticSeverity.Information,
  )

  diagnostic.source = PAGE_FILE_DIAGNOSTIC_SOURCE
  return [diagnostic]
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
