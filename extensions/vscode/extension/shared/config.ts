import * as vscode from 'vscode'

export function getExtensionConfiguration() {
  return vscode.workspace.getConfiguration('weapp-vite')
}

export function isStatusBarEnabled() {
  return getExtensionConfiguration().get('showStatusBar', true)
}

export function isPackageJsonDiagnosticsEnabled() {
  return getExtensionConfiguration().get('enablePackageJsonDiagnostics', true)
}

export function isAppJsonDiagnosticsEnabled() {
  return getExtensionConfiguration().get('enableAppJsonDiagnostics', true)
}

export function isHoverEnabled() {
  return getExtensionConfiguration().get('enableHover', true)
}

export function isCompletionEnabled() {
  return getExtensionConfiguration().get('enableCompletion', true)
}

export function isWxmlEnhancementEnabled() {
  return getExtensionConfiguration().get('enableWxmlEnhancements', true)
}

export function isVueTemplateWxmlEnhancementEnabled() {
  return getExtensionConfiguration().get('enableVueTemplateWxmlEnhancements', true)
}

export function isStandaloneWxmlEnhancementEnabled() {
  return getExtensionConfiguration().get('enableStandaloneWxmlEnhancements', true)
}

export function isWxmlDefinitionEnabled() {
  return getExtensionConfiguration().get('enableWxmlDefinition', true)
}

export function isTemplateDecorationEnabled() {
  return getExtensionConfiguration().get('enableTemplateDecorations', true)
}

export function useWvAlias() {
  return getExtensionConfiguration().get('preferWvAlias', true)
}
