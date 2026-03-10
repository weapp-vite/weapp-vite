import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    npm: {
      mainPackageDependencies: false,
      subPackages: {
        packageA: {
          dependencies: [
            'dayjs',
            'clsx',
          ],
        },
        packageB: {
          dependencies: [
            'dayjs',
            'class-variance-authority',
          ],
        },
      },
    },
  },
})
