import type * as vscode from 'vscode'
import path from 'node:path'
import { TEMPLATE_EXTENSIONS } from '@weapp-vite/language-service'

export const MINI_PROGRAM_TEMPLATE_LANGUAGE_ID = 'miniprogram-template'

export const MINI_PROGRAM_TEMPLATE_EXTENSIONS = TEMPLATE_EXTENSIONS

export const TEMPLATE_DOCUMENT_SELECTORS: vscode.DocumentSelector = [
  { language: 'vue', scheme: 'file' },
  { language: 'html', scheme: 'file' },
  { language: 'wxml', scheme: 'file' },
  { language: MINI_PROGRAM_TEMPLATE_LANGUAGE_ID, scheme: 'file' },
]

export const MINI_PROGRAM_TEMPLATE_DOCUMENT_SELECTORS: vscode.DocumentSelector = [
  { language: 'wxml', scheme: 'file' },
  { language: MINI_PROGRAM_TEMPLATE_LANGUAGE_ID, scheme: 'file' },
]

export function isMiniProgramTemplatePath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  return MINI_PROGRAM_TEMPLATE_EXTENSIONS.includes(extension as typeof MINI_PROGRAM_TEMPLATE_EXTENSIONS[number])
}

/** 项目图按源码后缀识别 Vue，不依赖用户是否安装 Vue 语言扩展。 */
export function isVueSourceDocument(document: Pick<vscode.TextDocument, 'uri' | 'languageId'>) {
  return document.languageId === 'vue' || path.extname(document.uri.fsPath).toLowerCase() === '.vue'
}

export function getTemplateFileCandidates(filePath: string) {
  const extension = path.extname(filePath)
  const basePath = extension ? filePath.slice(0, -extension.length) : filePath

  return [
    `${basePath}.vue`,
    `${basePath}.html`,
    ...MINI_PROGRAM_TEMPLATE_EXTENSIONS.map(templateExtension => `${basePath}${templateExtension}`),
  ]
}

export function isStandaloneTemplateDocument(document: vscode.TextDocument) {
  return document.languageId === 'html'
    || document.languageId === 'wxml'
    || document.languageId === MINI_PROGRAM_TEMPLATE_LANGUAGE_ID
    || isMiniProgramTemplatePath(document.uri.fsPath)
}
