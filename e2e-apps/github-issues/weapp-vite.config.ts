import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    wevu: {
      autoSetDataPick: true,
    },
    npm: {
      mainPackage: {
        dependencies: false,
      },
      subPackages: {
        'subpackages/issue-327': {
          dependencies: [
            'dayjs',
            /^tdesign-miniprogram$/,
          ],
        },
        'subpackages/item': {
          dependencies: [
            'lodash',
          ],
        },
        'subpackages/user': {
          dependencies: [
            /^merge$/,
          ],
        },
      },
    },
  },
})
