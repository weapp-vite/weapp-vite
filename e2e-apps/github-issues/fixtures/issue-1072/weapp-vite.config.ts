import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: { minify: false },
  weapp: {
    srcRoot: 'src',
    json: {
      defaults: { page: { navigationBarTitleText: 'default' } },
      mergeStrategy(target, source, context) {
        const config = { ...target, ...source }
        if (context.kind === 'page') {
          config.navigationBarTitleText = `${context.routeConfig?.name ?? 'missing'}:${context.pageMeta?.layout === false ? 'static' : 'dynamic'}`
        }
        return config
      },
    },
  },
})
