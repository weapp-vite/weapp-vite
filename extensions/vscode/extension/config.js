const vscode = require('vscode')

function getExtensionConfiguration() {
  return vscode.workspace.getConfiguration('weapp-vite')
}

function isStatusBarEnabled() {
  return getExtensionConfiguration().get('showStatusBar', true)
}

function isPackageJsonDiagnosticsEnabled() {
  return getExtensionConfiguration().get('enablePackageJsonDiagnostics', true)
}

function isHoverEnabled() {
  return getExtensionConfiguration().get('enableHover', true)
}

function isCompletionEnabled() {
  return getExtensionConfiguration().get('enableCompletion', true)
}

function useWvAlias() {
  return getExtensionConfiguration().get('preferWvAlias', true)
}

module.exports = {
  getExtensionConfiguration,
  isCompletionEnabled,
  isHoverEnabled,
  isPackageJsonDiagnosticsEnabled,
  isStatusBarEnabled,
  useWvAlias,
}
