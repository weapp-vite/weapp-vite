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
  getAppJsonRouteInsertText,
  getPackageJsonScriptHover,
  getViteConfigHover,
  getVueCustomBlockHover,
} from './content'
import {
  getAppJsonPageRouteSuggestions,
  isAppJsonDocument,
  isPackageJsonDocument,
  isViteConfigDocument,
  isVueDocument,
} from './workspace'

export class WeappViteCodeActionProvider {
  provideCodeActions(document: any, range: any) {
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
      const openProjectFileAction = new vscode.CodeAction(
        '打开 weapp-vite 关键文件 / 页面',
        vscode.CodeActionKind.QuickFix,
      )
      openProjectFileAction.command = {
        command: 'weapp-vite.openProjectFile',
        title: '打开 weapp-vite 关键文件 / 页面',
      }
      actions.push(openProjectFileAction)
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
      const lineText = document.lineAt(range.start.line).text

      if (!VUE_JSON_BLOCK_PATTERN.test(lineText)) {
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

export class WeappViteConfigCompletionProvider {
  provideCompletionItems(document: any, position: any) {
    if (!isCompletionEnabled()) {
      return []
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character)
    /** @type {import('vscode').CompletionItem[]} */
    const items = []

    if (linePrefix.trim().length === 0 || linePrefix.includes('import')) {
      const defineConfigItem = new vscode.CompletionItem('defineConfig', vscode.CompletionItemKind.Function)
      defineConfigItem.insertText = new vscode.SnippetString('defineConfig({\n  $1\n})')
      defineConfigItem.detail = 'weapp-vite defineConfig'
      items.push(defineConfigItem)
    }

    if (linePrefix.trimStart().startsWith('g') || linePrefix.includes('{')) {
      const generateItem = new vscode.CompletionItem('generate', vscode.CompletionItemKind.Property)
      generateItem.insertText = new vscode.SnippetString('generate: {\n    $1\n  },')
      generateItem.documentation = new vscode.MarkdownString(`参考文档：${DOCS_GENERATE_URL}`)
      items.push(generateItem)
    }

    if (linePrefix.trimStart().startsWith('p') || linePrefix.includes('{')) {
      const pluginsItem = new vscode.CompletionItem('plugins', vscode.CompletionItemKind.Property)
      pluginsItem.insertText = new vscode.SnippetString('plugins: [\n    $1\n  ],')
      pluginsItem.detail = 'Vite / weapp-vite plugins'
      items.push(pluginsItem)
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

    if (isViteConfigDocument(document)) {
      const markdown = getViteConfigHover(wordText, lineText)

      if (markdown) {
        return new vscode.Hover(markdown)
      }
    }

    if (isVueDocument(document)) {
      const markdown = getVueCustomBlockHover(lineText)

      if (markdown) {
        return new vscode.Hover(markdown)
      }
    }

    return null
  }
}
