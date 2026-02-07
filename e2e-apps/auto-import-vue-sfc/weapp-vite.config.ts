import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: {
      globs: ['components/**/*.vue', 'components/**/*.wxml'],
      typedComponents: true,
      vueComponents: true,
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
