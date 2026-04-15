import vscode from 'vscode'

import {
  getExtensionConfiguration,
} from './config'
import {
  WEAPP_VITE_CONFIG_FILE_NAMES,
  WEAPP_VITE_FILE_ICON_THEME_ID,
} from './constants'

export function isWeappViteFileIconThemeActive() {
  return vscode.workspace.getConfiguration('workbench').get('iconTheme') === WEAPP_VITE_FILE_ICON_THEME_ID
}

export async function hasWeappViteConfigFile() {
  for (const fileName of WEAPP_VITE_CONFIG_FILE_NAMES) {
    const matches = await vscode.workspace.findFiles(`**/${fileName}`, '**/node_modules/**', 1)

    if (matches.length > 0) {
      return true
    }
  }

  return false
}

export async function enableWeappViteFileIcons() {
  await vscode.workspace.getConfiguration('workbench').update('iconTheme', WEAPP_VITE_FILE_ICON_THEME_ID, vscode.ConfigurationTarget.Global)
}

export async function disableFileIconPrompt() {
  await getExtensionConfiguration().update('promptFileIcons', false, vscode.ConfigurationTarget.Global)
}

export async function maybePromptForWeappViteFileIcons() {
  if (!getExtensionConfiguration().get('promptFileIcons', true)) {
    return
  }

  if (isWeappViteFileIconThemeActive()) {
    return
  }

  if (!await hasWeappViteConfigFile()) {
    return
  }

  const selection = await vscode.window.showInformationMessage(
    '检测到 weapp-vite 配置文件。当前 Explorer 文件图标不是 weapp-vite File Icons，所以 weapp-vite.config.* 仍会显示为默认 TS/JS 图标。',
    '切换图标主题',
    '不再提示',
  )

  if (selection === '切换图标主题') {
    await enableWeappViteFileIcons()
    void vscode.window.showInformationMessage('已切换到 weapp-vite File Icons。')
  }

  if (selection === '不再提示') {
    await disableFileIconPrompt()
  }
}
