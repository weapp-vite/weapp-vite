import * as vscode from 'vscode'

import {
  WEAPP_VITE_FILE_ICON_THEME_ID,
} from '../shared/constants'

export async function enableWeappViteFileIcons() {
  await vscode.workspace.getConfiguration('workbench').update('iconTheme', WEAPP_VITE_FILE_ICON_THEME_ID, vscode.ConfigurationTarget.Global)
}
