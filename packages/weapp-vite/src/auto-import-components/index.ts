import type { PluginOption } from 'vite'

export function AutoImportComponents(): PluginOption {
  return {
    name: 'weapp-vite:auto-import-components',
    enforce: 'post',
    buildStart() {
      console.log('weapp-vite:auto-import-components')
    },
  }
}
