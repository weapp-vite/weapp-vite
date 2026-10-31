import type { DocumentInput, LanguageOptions, LanguagePlatform } from '@weapp-vite/language-service'
import type * as vscode from 'vscode'
import { analyzeDocument, isScriptModuleFile, resolveLanguageProfile, TEMPLATE_EXTENSIONS } from '@weapp-vite/language-service'
import * as editor from 'vscode'
import { getCachedLanguageDocumentInput, getLanguageDocumentState } from './project'

export const SCRIPT_LANGUAGE_ID = 'miniprogram-script'

export const NATIVE_SCRIPT_DOCUMENT_SELECTORS = [
  { language: SCRIPT_LANGUAGE_ID, scheme: 'file' },
] satisfies vscode.DocumentSelector

export const NATIVE_STYLE_DOCUMENT_SELECTORS = [
  { language: 'css', scheme: 'file' },
] satisfies vscode.DocumentSelector

/** 仅处理已登记的原生模板及脚本，标准 TS/CSS 诊断仍归原语言服务。 */
export function isNativeLanguageDocument(document: Pick<vscode.TextDocument, 'uri' | 'languageId'>) {
  const fileName = document.uri.fsPath.toLowerCase()
  return TEMPLATE_EXTENSIONS.some(extension => fileName.endsWith(extension))
    || isScriptModuleFile(fileName)
    || document.languageId === SCRIPT_LANGUAGE_ID
}

/** 仅接管由模板引用确认的普通脚本模块，普通 JS/TS 保持原有语言服务及格式化器。 */
export async function synchronizeNativeScriptLanguage(document: vscode.TextDocument) {
  if (!['javascript', 'typescript'].includes(document.languageId)) {
    return
  }
  const version = document.version
  try {
    const { input } = await getLanguageDocumentState(document)
    if (!document.isClosed && document.version === version && (input.dialect || input.sourceKind === 'native')) {
      await editor.languages.setTextDocumentLanguage(document, SCRIPT_LANGUAGE_ID)
    }
  }
  catch {
    // 共享配置错误由语言诊断展示；识别失败不改变用户的文档语言。
  }
}

/** 编辑器传递项目相对路径，使 glob 与 CLI 解析完全一致。 */
export async function getLanguageDocumentInput(document: vscode.TextDocument): Promise<DocumentInput> {
  return (await getLanguageDocumentState(document)).input
}

export async function analyzeLanguageDocument(document: vscode.TextDocument) {
  return analyzeDocument(await getLanguageDocumentInput(document))
}

/** 语言交互依据文件方言，HTML/Vue 默认兼容既有微信模板能力。 */
export function getDocumentPlatform(document: Pick<vscode.TextDocument, 'uri'>, options?: LanguageOptions): LanguagePlatform {
  const input = getCachedLanguageDocumentInput(document as vscode.TextDocument)
  return input?.platform ?? resolveLanguageProfile(input?.fileName ?? document.uri.fsPath, options ?? input?.options)?.platform ?? 'weapp'
}
