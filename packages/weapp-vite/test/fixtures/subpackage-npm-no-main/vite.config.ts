import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    npm: {
      mainPackage: {
        dependencies: false,
      },
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
