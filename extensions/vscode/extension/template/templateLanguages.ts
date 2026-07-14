import type * as vscode from 'vscode'
import path from 'node:path'

export const MINI_PROGRAM_TEMPLATE_LANGUAGE_ID = 'miniprogram-template'

export const MINI_PROGRAM_TEMPLATE_EXTENSIONS = [
  '.wxml',
  '.axml',
  '.ttml',
  '.swan',
  '.jxml',
  '.qml',
  '.ksml',
  '.xhsml',
  '.tyml',
] as const

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
