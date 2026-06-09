import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    autoImportComponents: {
      components: {
        't-button': 'tdesign-miniprogram/button/button',
        't-cell': 'tdesign-miniprogram/cell/cell',
        't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
        't-divider': 'tdesign-miniprogram/divider/divider',
        't-empty': 'tdesign-miniprogram/empty/empty',
        't-grid': 'tdesign-miniprogram/grid/grid',
        't-grid-item': 'tdesign-miniprogram/grid-item/grid-item',
        't-input': 'tdesign-miniprogram/input/input',
        't-message': 'tdesign-miniprogram/message/message',
        't-notice-bar': 'tdesign-miniprogram/notice-bar/notice-bar',
        't-progress': 'tdesign-miniprogram/progress/progress',
        't-rate': 'tdesign-miniprogram/rate/rate',
        't-stepper': 'tdesign-miniprogram/stepper/stepper',
        't-switch': 'tdesign-miniprogram/switch/switch',
        't-tabs': 'tdesign-miniprogram/tabs/tabs',
        't-tab-panel': 'tdesign-miniprogram/tab-panel/tab-panel',
        't-tag': 'tdesign-miniprogram/tag/tag',
        't-textarea': 'tdesign-miniprogram/textarea/textarea',
        't-toast': 'tdesign-miniprogram/toast/toast',
      },
    },
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            'tdesign-miniprogram/*': ['./node_modules/tdesign-miniprogram/miniprogram_dist/*'],
          },
        },
      },
    },
  },
})
