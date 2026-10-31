import type { Diagnostic } from '@weapp-vite/language-service'
import * as vscode from 'vscode'
import { isStandaloneWxmlEnhancementEnabled, isWxmlEnhancementEnabled } from '../shared/config'
import { analyzeLanguageDocument, isNativeLanguageDocument } from './documents'

/** 使用与 CLI 相同的 UTF-16 源码区间创建编辑器诊断。 */
export function toEditorDiagnostic(document: vscode.TextDocument, diagnostic: Diagnostic) {
  const severity = diagnostic.severity === 'error'
    ? vscode.DiagnosticSeverity.Error
    : diagnostic.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information
  const result = new vscode.Diagnostic(new vscode.Range(document.positionAt(diagnostic.start), document.positionAt(diagnostic.end)), diagnostic.message, severity)
  result.code = diagnostic.code
  result.source = 'weapp-vite'
  return result
}

/** 每个打开文档独立防抖；版本变化后丢弃旧结果，避免覆盖新诊断。 */
export class LanguageDiagnosticController implements vscode.Disposable {
  private readonly diagnostics = vscode.languages.createDiagnosticCollection('weapp-vite-languages')
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly formattingErrors = new Map<string, number>()

  reportFormattingError(document: vscode.TextDocument, error: unknown) {
    const structured = error && typeof error === 'object' && 'diagnostics' in error && Array.isArray(error.diagnostics)
      ? error.diagnostics as Diagnostic[]
      : [{ start: 0, end: 0, code: 'format/refused', message: error instanceof Error ? error.message : String(error), severity: 'error' as const }]
    this.formattingErrors.set(document.uri.toString(), document.version)
    this.diagnostics.set(document.uri, structured.map(diagnostic => toEditorDiagnostic(document, diagnostic)))
  }

  refresh(document: vscode.TextDocument, force = false) {
    const key = document.uri.toString()
    if (force) {
      this.formattingErrors.delete(key)
    }
    if (this.formattingErrors.get(key) === document.version) {
      return
    }
    this.formattingErrors.delete(key)
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
    if (!isNativeLanguageDocument(document) || !isWxmlEnhancementEnabled() || !isStandaloneWxmlEnhancementEnabled()) {
      this.diagnostics.delete(document.uri)
      return
    }
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key)
      void this.analyze(document)
    }, 150))
  }

  close(document: vscode.TextDocument) {
    const key = document.uri.toString()
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
    this.diagnostics.delete(document.uri)
    this.formattingErrors.delete(key)
  }

  private async analyze(document: vscode.TextDocument) {
    const version = document.version
    try {
      const result = await analyzeLanguageDocument(document)
      if (!document.isClosed && document.version === version && !this.formattingErrors.has(document.uri.toString())) {
        this.diagnostics.set(document.uri, result.diagnostics.map(diagnostic => toEditorDiagnostic(document, diagnostic)))
      }
    }
    catch (error) {
      if (!document.isClosed && document.version === version && !this.formattingErrors.has(document.uri.toString())) {
        const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), error instanceof Error ? error.message : String(error), vscode.DiagnosticSeverity.Error)
        diagnostic.source = 'weapp-vite'
        diagnostic.code = 'project-language-configuration'
        this.diagnostics.set(document.uri, [diagnostic])
      }
    }
  }

  dispose() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.formattingErrors.clear()
    this.diagnostics.dispose()
  }
}
