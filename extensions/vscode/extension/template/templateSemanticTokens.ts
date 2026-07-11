import * as vscode from 'vscode'

import {
  collectDefinedTemplateClassDecorationRanges,
  isDecorationEnabledForDocument,
} from './templateDecorations'

export const TEMPLATE_SEMANTIC_TOKENS_LEGEND = new vscode.SemanticTokensLegend(['class'])

export class WeappTemplateSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  async provideDocumentSemanticTokens(document: vscode.TextDocument) {
    const builder = new vscode.SemanticTokensBuilder(TEMPLATE_SEMANTIC_TOKENS_LEGEND)

    if (!(await isDecorationEnabledForDocument(document))) {
      return builder.build()
    }

    for (const range of await collectDefinedTemplateClassDecorationRanges(document)) {
      builder.push(range, 'class')
    }

    return builder.build()
  }
}
