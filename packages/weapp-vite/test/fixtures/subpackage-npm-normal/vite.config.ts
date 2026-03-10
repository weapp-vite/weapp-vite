import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    npm: {
      experimentalNormalSubpackageNpm: true,
      mainPackageDependencies: false,
    },
    subPackages: {
      packageA: {
        dependencies: [
          'dayjs',
          'tdesign-miniprogram',
          'clsx',
        ],
      },
      packageB: {
        dependencies: [
          'dayjs',
          'tdesign-miniprogram',
          'class-variance-authority',
        ],
      },
    },
  },
})
