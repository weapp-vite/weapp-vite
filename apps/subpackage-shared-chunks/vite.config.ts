import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    // pnpm g 生成的格式
    // https://vite.icebreaker.top/guide/generate.html
    generate: {
      extensions: {
        js: 'ts',
        wxss: 'scss',
      },
      dirs: {
        component: 'src/components',
        page: 'src/pages',
      },
    },
    jsFormat: 'esm',
    // jsFormat: 'esm',
    npm: {
      enable: false,
    },
    subPackages: {
      'packages/order': {
        independent: true,
        dependencies: ['crypto-es'],
        styles: [
          'styles/theme.scss',
          {
            source: '../shared/styles/components.scss',
            scope: 'components',
            include: ['components/**'],
          },
        ],
      },
      'packages/profile': {
        styles: {
          source: 'styles/index.scss',
          scope: 'pages',
        },
      },
      'packages/marketing': {
        watchSharedStyles: false,
      },
    },
    chunks: {
      sharedStrategy: 'duplicate',
      duplicateWarningBytes: 256 * 1024,
    },
  },
  build: {
    rolldownOptions: {
      output: {
        minify: false,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
  plugins: [
  ],
},
)
