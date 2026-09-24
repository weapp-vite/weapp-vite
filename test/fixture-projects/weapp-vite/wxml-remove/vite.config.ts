import { defineConfig } from 'weapp-vite/config'

export default defineConfig(({ mode }) => ({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: false,
    wxml: {
      remove: mode === 'legacy' ? undefined
        : mode === 'custom' ? { attr: [{ tag: ['view', 'text'], name: ['data-debug-*'] }], tag: ['debug-panel', 'dev-only-*'] }
          : mode === 'empty' ? { attr: [], tag: [], comment: false }
            : mode === 'comments' ? { attr: [], comment: true }
              : mode === 'unsafe' ? { tag: ['branch-debug'] }
                : mode === 'framework' ? { tag: ['include'] }
                  : mode === 'runtime' ? { attr: ['*'], comment: true }
                    : mode === 'production',
    },
    vue: { template: { htmlTagToWxml: true, formatWxml: false } },
  },
  build: { minify: false },
}))
