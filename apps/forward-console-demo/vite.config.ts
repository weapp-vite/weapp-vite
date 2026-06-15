import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    forwardConsole: {
      enabled: true,
      logLevels: ['debug', 'log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    },
    generate: {
      extensions: {
        js: 'ts',
        wxss: 'scss',
      },
      dirs: {
        page: 'src/pages',
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
})
