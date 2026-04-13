import vscode from 'vscode'

import {
  isCompletionEnabled,
  isHoverEnabled,
} from './config'
import {
  COMMON_SCRIPT_NAMES,
  DOCS_GENERATE_URL,
  PACKAGE_JSON_PROPERTY_PREFIX_PATTERN,
  SCRIPT_COMMAND_SUGGESTIONS,
  VUE_JSON_BLOCK_PATTERN,
} from './constants'
import {
  getAppJsonRouteCompletionContext,
  getAppJsonRouteHover,
  getAppJsonRouteInsertText,
  getPackageJsonScriptHover,
  getViteConfigHover,
  getVueCustomBlockHover,
  getVuePageConfigHover,
  getVuePageTitleConsistencyState,
} from './content'
import {
  getDefinePageJsonCompletionContext,
  getViteConfigObjectPath,
  getVueJsonBlockCompletionContext,
  getVuePageConfigState,
} from './logic'
import {
  getQuotedRouteRangesAtLine,
  getQuotedRouteValueAtLine,
} from './navigation'
import {
  getAppJsonPageRouteSuggestions,
  getAppJsonRouteFileStatus,
  getCurrentPageRouteCandidate,
  isAppJsonDocument,
  isPackageJsonDocument,
  isViteConfigDocument,
  isVueDocument,
} from './workspace'

const QUOTED_STRING_PATTERN = /"([^"]+)"/u
const VUE_JSON_BLOCK_COMPLETION_ITEMS = [
  {
    label: 'navigationBarTitleText',
    insertText: '"navigationBarTitleText": "$1"',
    detail: '页面标题',
  },
  {
    label: 'enablePullDownRefresh',
    insertText: '"enablePullDownRefresh": true',
    detail: '启用下拉刷新',
  },
  {
    label: 'backgroundColor',
    insertText: '"backgroundColor": "#f6f7fb"',
    detail: '页面背景色',
  },
  {
    label: 'backgroundTextStyle',
    insertText: '"backgroundTextStyle": "dark"',
    detail: '下拉 loading 样式',
  },
  {
    label: 'navigationStyle',
    insertText: '"navigationStyle": "default"',
    detail: '导航栏样式',
  },
  {
    label: 'disableScroll',
    insertText: '"disableScroll": true',
    detail: '禁止页面滚动',
  },
]
const DEFINE_PAGE_JSON_COMPLETION_ITEMS = [
  {
    label: 'navigationBarTitleText',
    insertText: 'navigationBarTitleText: \'$1\',',
    detail: '页面标题',
  },
  {
    label: 'enablePullDownRefresh',
    insertText: 'enablePullDownRefresh: true,',
    detail: '启用下拉刷新',
  },
  {
    label: 'backgroundColor',
    insertText: 'backgroundColor: \'#f6f7fb\',',
    detail: '页面背景色',
  },
  {
    label: 'backgroundTextStyle',
    insertText: 'backgroundTextStyle: \'dark\',',
    detail: '下拉 loading 样式',
  },
  {
    label: 'navigationStyle',
    insertText: 'navigationStyle: \'default\',',
    detail: '导航栏样式',
  },
  {
    label: 'disableScroll',
    insertText: 'disableScroll: true,',
    detail: '禁止页面滚动',
  },
]
const PAGE_CONFIG_VALUE_COMPLETION_ITEMS: Record<string, Array<{
  detail: string
  insertText: string
  kind: number
  label: string
}>> = {
  backgroundTextStyle: [
    {
      label: 'dark',
      kind: vscode.CompletionItemKind.Value,
      insertText: 'dark',
      detail: '下拉 loading 深色样式',
    },
    {
      label: 'light',
      kind: vscode.CompletionItemKind.Value,
      insertText: 'light',
      detail: '下拉 loading 浅色样式',
    },
  ],
  navigationStyle: [
    {
      label: 'default',
      kind: vscode.CompletionItemKind.Value,
      insertText: 'default',
      detail: '默认导航栏样式',
    },
    {
      label: 'custom',
      kind: vscode.CompletionItemKind.Value,
      insertText: 'custom',
      detail: '自定义导航栏样式',
    },
  ],
}
const PAGE_CONFIG_BOOLEAN_VALUE_COMPLETION_ITEMS: Record<string, Array<{
  detail: string
  insertText: string
  kind: number
  label: string
}>> = {
  disableScroll: [
    {
      label: 'true',
      kind: vscode.CompletionItemKind.Value,
      insertText: 'true',
      detail: '启用后禁止页面滚动',
    },
    {
      label: 'false',
      kind: vscode.CompletionItemKind.Value,
      insertText: 'false',
      detail: '保持页面可滚动',
    },
  ],
  enablePullDownRefresh: [
    {
      label: 'true',
      kind: vscode.CompletionItemKind.Value,
      insertText: 'true',
      detail: '启用下拉刷新',
    },
    {
      label: 'false',
      kind: vscode.CompletionItemKind.Value,
      insertText: 'false',
      detail: '关闭下拉刷新',
    },
  ],
}

const VITE_CONFIG_COMPLETION_SETS: Record<string, Array<{
  detail: string
  documentation?: string
  insertText: string
  kind: number
  label: string
}>> = {
  'root': [
    {
      label: 'weapp',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'weapp: {\n    $1\n  },',
      detail: 'weapp-vite 主配置',
    },
    {
      label: 'plugins',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'plugins: [\n    $1\n  ],',
      detail: 'Vite / weapp-vite plugins',
    },
    {
      label: 'css',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'css: {\n    $1\n  },',
      detail: 'Vite CSS 配置',
    },
  ],
  'weapp': [
    {
      label: 'srcRoot',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'srcRoot: \'src\',',
      detail: 'weapp 源码根目录',
    },
    {
      label: 'generate',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'generate: {\n      $1\n    },',
      detail: '页面/组件生成配置',
      documentation: `参考文档：${DOCS_GENERATE_URL}`,
    },
    {
      label: 'multiPlatform',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'multiPlatform: true,',
      detail: '启用多平台构建能力',
    },
    {
      label: 'web',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'web: {\n      enable: true,\n      outDir: \'dist/web\',\n    },',
      detail: 'Web 运行时配置',
    },
    {
      label: 'injectWeapi',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'injectWeapi: {\n      enabled: true,\n      replaceWx: true,\n    },',
      detail: 'weapi 注入配置',
    },
    {
      label: 'autoImportComponents',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'autoImportComponents: {\n      globs: [\'components/**/*\'],\n      resolvers: [\n        $1\n      ],\n    },',
      detail: '自动导入组件配置',
    },
    {
      label: 'subPackages',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'subPackages: {\n      packageA: {\n        dependencies: [],\n      },\n    },',
      detail: '分包依赖配置',
    },
    {
      label: 'worker',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'worker: {\n      entry: [\n        \'index\',\n      ],\n    },',
      detail: 'worker 入口配置',
    },
    {
      label: 'copy',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'copy: {\n      include: [\n        $1\n      ],\n    },',
      detail: '额外拷贝文件配置',
    },
    {
      label: 'jsonAlias',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'jsonAlias: {\n      entries: [\n        {\n          find: \'@\',\n          replacement: $1,\n        },\n      ],\n    },',
      detail: 'json alias 配置',
    },
  ],
  'weapp.generate': [
    {
      label: 'extensions',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'extensions: {\n        js: \'ts\',\n        wxss: \'scss\',\n      },',
      detail: '生成文件扩展名配置',
      documentation: `参考文档：${DOCS_GENERATE_URL}`,
    },
    {
      label: 'dirs',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'dirs: {\n        component: \'src/components\',\n        page: \'src/pages\',\n      },',
      detail: '生成目录配置',
      documentation: `参考文档：${DOCS_GENERATE_URL}`,
    },
    {
      label: 'filenames',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'filenames: {\n        component: \'index\',\n        page: \'index\',\n      },',
      detail: '生成文件名配置',
      documentation: `参考文档：${DOCS_GENERATE_URL}`,
    },
  ],
  'weapp.generate.extensions': [
    {
      label: 'js',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'js: \'ts\',',
      detail: '脚本扩展名',
    },
    {
      label: 'wxss',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'wxss: \'scss\',',
      detail: '样式扩展名',
    },
  ],
  'weapp.generate.dirs': [
    {
      label: 'component',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'component: \'src/components\',',
      detail: '组件目录',
    },
    {
      label: 'page',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'page: \'src/pages\',',
      detail: '页面目录',
    },
  ],
  'weapp.generate.filenames': [
    {
      label: 'component',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'component: \'index\',',
      detail: '组件文件名',
    },
    {
      label: 'page',
      kind: vscode.CompletionItemKind.Property,
      insertText: 'page: \'index\',',
      detail: '页面文件名',
    },
  ],
}

export class WeappViteCodeActionProvider {
  async provideCodeActions(document: any, range: any) {
    /** @type {import('vscode').CodeAction[]} */
    const actions = []

    if (isPackageJsonDocument(document)) {
      const insertScriptsAction = new vscode.CodeAction(
        '补齐常用 weapp-vite scripts',
        vscode.CodeActionKind.QuickFix,
      )
      insertScriptsAction.command = {
        command: 'weapp-vite.insertCommonScripts',
        title: '补齐常用 weapp-vite scripts',
        arguments: [document],
      }
      actions.push(insertScriptsAction)
    }

    if (isAppJsonDocument(document)) {
      const lineText = document.lineAt(range.start.line).text
      const routeMatch = lineText.match(QUOTED_STRING_PATTERN)
      const openProjectFileAction = new vscode.CodeAction(
        '打开 weapp-vite 关键文件 / 页面',
        vscode.CodeActionKind.QuickFix,
      )
      openProjectFileAction.command = {
        command: 'weapp-vite.openProjectFile',
        title: '打开 weapp-vite 关键文件 / 页面',
      }
      actions.push(openProjectFileAction)

      if (routeMatch) {
        const routeFileStatus = await getAppJsonRouteFileStatus(document, routeMatch[1])

        if (routeFileStatus?.pageFilePath) {
          const openPageAction = new vscode.CodeAction(
            '打开页面文件',
            vscode.CodeActionKind.QuickFix,
          )
          openPageAction.command = {
            command: 'weapp-vite.openPageFromRoute',
            title: '打开页面文件',
            arguments: [document, routeMatch[1]],
          }
          actions.push(openPageAction)
        }
        else {
          const createPageAction = new vscode.CodeAction(
            '创建缺失页面文件',
            vscode.CodeActionKind.QuickFix,
          )
          createPageAction.command = {
            command: 'weapp-vite.createPageFromRoute',
            title: '创建缺失页面文件',
            arguments: [document, routeMatch[1]],
          }
          actions.push(createPageAction)
        }
      }
    }

    if (isViteConfigDocument(document)) {
      const defineConfigAction = new vscode.CodeAction(
        '插入 weapp-vite defineConfig 模板',
        vscode.CodeActionKind.RefactorRewrite,
      )
      defineConfigAction.command = {
        command: 'weapp-vite.insertDefineConfigTemplate',
        title: '插入 weapp-vite defineConfig 模板',
      }
      actions.push(defineConfigAction)
    }

    if (isVueDocument(document)) {
      const documentText = document.getText()
      const pageConfigState = getVuePageConfigState(documentText)
      const titleConsistencyState = getVuePageTitleConsistencyState(documentText)
      const currentPageCandidate = await getCurrentPageRouteCandidate(document)

      if (currentPageCandidate && !currentPageCandidate.declared) {
        const addPageToAppJsonAction = new vscode.CodeAction(
          '将当前页面加入 app.json',
          vscode.CodeActionKind.QuickFix,
        )
        addPageToAppJsonAction.command = {
          command: 'weapp-vite.addCurrentPageToAppJson',
          title: '将当前页面加入 app.json',
        }
        actions.push(addPageToAppJsonAction)
      }

      const lineText = document.lineAt(range.start.line).text

      if (!pageConfigState.hasDefinePageJson) {
        const definePageJsonAction = new vscode.CodeAction(
          '插入 definePageJson 模板',
          vscode.CodeActionKind.RefactorRewrite,
        )
        definePageJsonAction.command = {
          command: 'weapp-vite.insertDefinePageJsonTemplate',
          title: '插入 definePageJson 模板',
        }
        actions.push(definePageJsonAction)
      }

      if (!pageConfigState.hasJsonBlock && !VUE_JSON_BLOCK_PATTERN.test(lineText)) {
        const jsonBlockAction = new vscode.CodeAction(
          '插入 weapp-vite <json> 自定义块',
          vscode.CodeActionKind.RefactorRewrite,
        )
        jsonBlockAction.command = {
          command: 'weapp-vite.insertJsonBlockTemplate',
          title: '插入 weapp-vite <json> 自定义块',
        }
        actions.push(jsonBlockAction)
      }

      if (titleConsistencyState && !titleConsistencyState.matches) {
        const syncTitleAction = new vscode.CodeAction(
          '将 <json> 标题同步为 definePageJson',
          vscode.CodeActionKind.QuickFix,
        )
        syncTitleAction.command = {
          command: 'weapp-vite.syncJsonTitleFromDefinePageJson',
          title: '将 <json> 标题同步为 definePageJson',
          arguments: [document],
        }
        actions.push(syncTitleAction)

        const syncDefinePageJsonTitleAction = new vscode.CodeAction(
          '将 definePageJson 标题同步为 <json>',
          vscode.CodeActionKind.QuickFix,
        )
        syncDefinePageJsonTitleAction.command = {
          command: 'weapp-vite.syncDefinePageJsonTitleFromJson',
          title: '将 definePageJson 标题同步为 <json>',
          arguments: [document],
        }
        actions.push(syncDefinePageJsonTitleAction)
      }
    }

    return actions
  }
}

export class WeappViteVueCompletionProvider {
  provideCompletionItems(document: any, position: any) {
    if (!isCompletionEnabled()) {
      return []
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character)
    const textBeforeCursor = document.getText(new vscode.Range(0, 0, position.line, position.character))
    const textAfterCursor = document.getText(new vscode.Range(position.line, position.character, document.lineCount, 0))
    const jsonBlockContext = getVueJsonBlockCompletionContext(textBeforeCursor, textAfterCursor, linePrefix)
    const definePageJsonContext = getDefinePageJsonCompletionContext(textBeforeCursor, textAfterCursor, linePrefix)

    if (jsonBlockContext?.type === 'property') {
      return VUE_JSON_BLOCK_COMPLETION_ITEMS.map((suggestion, index) => {
        const item = new vscode.CompletionItem(suggestion.label, vscode.CompletionItemKind.Property)
        item.insertText = new vscode.SnippetString(suggestion.insertText)
        item.detail = suggestion.detail
        item.sortText = `0${index}`
        return item
      })
    }

    if (jsonBlockContext?.type === 'value') {
      return (PAGE_CONFIG_VALUE_COMPLETION_ITEMS[jsonBlockContext.key] ?? []).map((suggestion, index) => {
        const item = new vscode.CompletionItem(suggestion.label, suggestion.kind)
        item.insertText = suggestion.insertText
        item.detail = suggestion.detail
        item.sortText = `0${index}`
        return item
      })
    }

    if (jsonBlockContext?.type === 'booleanValue') {
      return (PAGE_CONFIG_BOOLEAN_VALUE_COMPLETION_ITEMS[jsonBlockContext.key] ?? []).map((suggestion, index) => {
        const item = new vscode.CompletionItem(suggestion.label, suggestion.kind)
        item.insertText = suggestion.insertText
        item.detail = suggestion.detail
        item.sortText = `0${index}`
        return item
      })
    }

    if (definePageJsonContext?.type === 'property') {
      return DEFINE_PAGE_JSON_COMPLETION_ITEMS.map((suggestion, index) => {
        const item = new vscode.CompletionItem(suggestion.label, vscode.CompletionItemKind.Property)
        item.insertText = new vscode.SnippetString(suggestion.insertText)
        item.detail = suggestion.detail
        item.sortText = `0${index}`
        return item
      })
    }

    if (definePageJsonContext?.type === 'value') {
      return (PAGE_CONFIG_VALUE_COMPLETION_ITEMS[definePageJsonContext.key] ?? []).map((suggestion, index) => {
        const item = new vscode.CompletionItem(suggestion.label, suggestion.kind)
        item.insertText = suggestion.insertText
        item.detail = suggestion.detail
        item.sortText = `0${index}`
        return item
      })
    }

    if (definePageJsonContext?.type === 'booleanValue') {
      return (PAGE_CONFIG_BOOLEAN_VALUE_COMPLETION_ITEMS[definePageJsonContext.key] ?? []).map((suggestion, index) => {
        const item = new vscode.CompletionItem(suggestion.label, suggestion.kind)
        item.insertText = suggestion.insertText
        item.detail = suggestion.detail
        item.sortText = `0${index}`
        return item
      })
    }

    if (!linePrefix.trimStart().startsWith('<')) {
      return []
    }

    const item = new vscode.CompletionItem('json', vscode.CompletionItemKind.Snippet)
    item.insertText = new vscode.SnippetString('<json lang="jsonc">\n{\n  "$1": "$2"\n}\n</json>')
    item.documentation = new vscode.MarkdownString('Insert a `weapp-vite` custom `<json>` block.')
    item.detail = 'weapp-vite custom block'
    item.sortText = '0'

    return [item]
  }
}

export class WeappVitePackageJsonCompletionProvider {
  provideCompletionItems(document: any, position: any) {
    if (!isCompletionEnabled()) {
      return []
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character)

    if (linePrefix.includes('"scripts"')) {
      return []
    }

    if (PACKAGE_JSON_PROPERTY_PREFIX_PATTERN.test(linePrefix)) {
      return COMMON_SCRIPT_NAMES.map((scriptName, index) => {
        const item = new vscode.CompletionItem(scriptName, vscode.CompletionItemKind.Property)
        item.insertText = new vscode.SnippetString(`"${scriptName}": "${SCRIPT_COMMAND_SUGGESTIONS[scriptName]}"$0`)
        item.detail = `weapp-vite script: ${SCRIPT_COMMAND_SUGGESTIONS[scriptName]}`
        item.sortText = `0${index}`
        return item
      })
    }

    if (linePrefix.includes(': "')) {
      return Object.entries(SCRIPT_COMMAND_SUGGESTIONS).map(([scriptName, command], index) => {
        const item = new vscode.CompletionItem(command, vscode.CompletionItemKind.Value)
        item.insertText = command
        item.detail = `scripts.${scriptName}`
        item.sortText = `0${index}`
        return item
      })
    }

    return []
  }
}

export class WeappViteAppJsonCompletionProvider {
  async provideCompletionItems(document: any, position: any) {
    if (!isCompletionEnabled() || !isAppJsonDocument(document)) {
      return []
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character)
    const textBeforeCursor = document.getText(new vscode.Range(0, 0, position.line, position.character))
    const context = getAppJsonRouteCompletionContext(textBeforeCursor, linePrefix)

    if (!context) {
      return []
    }

    const routes = await getAppJsonPageRouteSuggestions(document)

    return routes
      .map((route, index) => {
        const insertText = getAppJsonRouteInsertText(route, context.root)

        if (!insertText) {
          return null
        }

        const item = new vscode.CompletionItem(insertText, vscode.CompletionItemKind.File)
        item.insertText = insertText
        item.detail = `page route: ${route}`
        item.documentation = new vscode.MarkdownString(`对应页面文件路由：\`${route}\``)
        item.sortText = `0${index}`
        return item
      })
      .filter(Boolean)
  }
}

export class WeappViteAppJsonDocumentLinkProvider {
  async provideDocumentLinks(document: any) {
    if (!isAppJsonDocument(document)) {
      return []
    }

    const links = []

    for (let line = 0; line < document.lineCount; line++) {
      const lineText = document.lineAt(line).text
      const routeRanges = getQuotedRouteRangesAtLine(lineText)

      for (const routeRange of routeRanges) {
        const status = await getAppJsonRouteFileStatus(document, routeRange.value)

        if (!status?.pageFilePath) {
          continue
        }

        const target = vscode.Uri.file(status.pageFilePath)
        const range = new vscode.Range(line, routeRange.start, line, routeRange.end)
        const link = new vscode.DocumentLink(range, target)

        link.tooltip = `打开页面文件 ${routeRange.value}`
        links.push(link)
      }
    }

    return links
  }
}

export class WeappViteConfigCompletionProvider {
  provideCompletionItems(document: any, position: any) {
    if (!isCompletionEnabled()) {
      return []
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character)
    const textBeforeCursor = document.getText(new vscode.Range(0, 0, position.line, position.character))
    const objectPath = getViteConfigObjectPath(textBeforeCursor)
    const completionSetKey = objectPath.length > 0 ? objectPath.join('.') : 'root'
    /** @type {import('vscode').CompletionItem[]} */
    const items = []

    if (linePrefix.trim().length === 0 || linePrefix.includes('import')) {
      const defineConfigItem = new vscode.CompletionItem('defineConfig', vscode.CompletionItemKind.Function)
      defineConfigItem.insertText = new vscode.SnippetString('defineConfig({\n  $1\n})')
      defineConfigItem.detail = 'weapp-vite defineConfig'
      items.push(defineConfigItem)
    }

    for (const [index, suggestion] of (VITE_CONFIG_COMPLETION_SETS[completionSetKey] ?? []).entries()) {
      const item = new vscode.CompletionItem(suggestion.label, suggestion.kind)
      item.insertText = new vscode.SnippetString(suggestion.insertText)
      item.detail = suggestion.detail
      item.sortText = `0${index}`

      if (suggestion.documentation) {
        item.documentation = new vscode.MarkdownString(suggestion.documentation)
      }

      items.push(item)
    }

    return items
  }
}

export class WeappViteHoverProvider {
  provideHover(document: any, position: any) {
    if (!isHoverEnabled()) {
      return null
    }

    const range = document.getWordRangeAtPosition(position)
    const wordText = range ? document.getText(range) : ''
    const lineText = document.lineAt(position.line).text

    if (isPackageJsonDocument(document)) {
      const markdown = getPackageJsonScriptHover(lineText)

      if (markdown) {
        return new vscode.Hover(markdown)
      }
    }

    if (isAppJsonDocument(document)) {
      const route = getQuotedRouteValueAtLine(lineText, position.character)

      if (route) {
        return getAppJsonRouteFileStatus(document, route).then((status) => {
          if (!status) {
            return null
          }

          return new vscode.Hover(getAppJsonRouteHover(
            status.route,
            status.pageFilePath,
            status.candidatePaths,
            status.workspacePath,
          ))
        })
      }
    }

    if (isViteConfigDocument(document)) {
      const markdown = getViteConfigHover(wordText, lineText)

      if (markdown) {
        return new vscode.Hover(markdown)
      }
    }

    if (isVueDocument(document)) {
      const markdown = getVueCustomBlockHover(lineText) ?? getVuePageConfigHover(wordText, lineText)

      if (markdown) {
        return new vscode.Hover(markdown)
      }
    }

    return null
  }
}
