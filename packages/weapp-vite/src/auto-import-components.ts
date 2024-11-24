import type { PluginOption } from 'vite'

export function AutoImportComponents(): PluginOption {
  return {
    name: 'weapp-vite:auto-import-components',
    enforce: 'pre',
    buildStart() {
      console.log('weapp-vite:auto-import-components')
    },
  }
}
