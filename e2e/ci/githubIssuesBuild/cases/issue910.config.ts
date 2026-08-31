import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: {
    minify: false,
    outDir: 'dist-issue-910',
  },
  weapp: {
    srcRoot: 'src/issue-fixtures/issue-910',
    autoRoutes: {
      enabled: true,
      include: [
        'pages/**',
        'subs/**',
      ],
    },
    subPackages: {
      subs: {},
    },
    chunks: {
      dynamicImports: 'native',
    },
  },
})
