import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: {
      globs: ['components/**/*.vue', 'components/**/*.wxml'],
      output: 'dist/auto-import-components.json',
      typedComponents: 'dist/typed-components.d.ts',
      vueComponents: 'dist/components.d.ts',
      resolvers: [
        {
          components: {
            ResolverCard: '/components/NativeCard/index',
          },
        },
      ],
    },
  },
})
