import vscode from 'vscode'

import {
  APP_JSON_DIAGNOSTIC_SOURCE,
  COMMON_SCRIPT_NAMES,
  DOCS_GENERATE_URL,
  DOCS_GUIDE_URL,
  DOCS_VSCODE_URL,
  PACKAGE_JSON_DIAGNOSTIC_SOURCE,
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

export {
  getAppJsonRouteCompletionContext,
  getAppJsonRouteInsertText,
}
