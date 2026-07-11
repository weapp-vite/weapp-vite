import * as vscode from 'vscode'

export function getExtensionConfiguration() {
  return vscode.workspace.getConfiguration('weapp-vite')
}

function getCompatibleBoolean(primaryKey: string, legacyKey: string) {
  const configuration = getExtensionConfiguration()
  const inspected = configuration.inspect?.<boolean>(primaryKey)
  const hasExplicitPrimaryValue = inspected && (
    inspected.globalValue != null
    || inspected.workspaceValue != null
    || inspected.workspaceFolderValue != null
  )

  if (hasExplicitPrimaryValue) {
    return configuration.get(primaryKey, true)
  }

  return configuration.get(legacyKey, configuration.get(primaryKey, true))
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
  return getCompatibleBoolean('enableTemplateEnhancements', 'enableWxmlEnhancements')
}

export function isVueTemplateWxmlEnhancementEnabled() {
  return getExtensionConfiguration().get('enableVueTemplateWxmlEnhancements', true)
}

export function isStandaloneWxmlEnhancementEnabled() {
  return getCompatibleBoolean('enableStandaloneTemplateEnhancements', 'enableStandaloneWxmlEnhancements')
}

export function isWxmlDefinitionEnabled() {
  return getCompatibleBoolean('enableTemplateDefinition', 'enableWxmlDefinition')
}

export function isTemplateDecorationEnabled() {
  return getExtensionConfiguration().get('enableTemplateDecorations', true)
}

export function useWvAlias() {
  return getExtensionConfiguration().get('preferWvAlias', true)
}
