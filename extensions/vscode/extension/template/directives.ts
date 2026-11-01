import type * as vscode from 'vscode'
import { getLanguageProfile } from '@weapp-vite/language-service'
import { getDocumentPlatform } from '../languages/documents'

/** 平台指令提示与诊断共用同一 profile，不从微信前缀推导其他平台。 */
export function getTemplateDirectiveEntries(document: vscode.TextDocument) {
  const profile = getLanguageProfile(getDocumentPlatform(document))
  return [...new Set(Object.values(profile.directives))].map(name => ({
    name,
    markdown: `模板指令 \`${name}\`\n\n[官方文档](${profile.documentation[0].url})`,
    boolean: name === profile.directives.else,
  }))
}
