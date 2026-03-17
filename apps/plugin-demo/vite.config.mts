const { defineConfig } = await import(/* @vite-ignore */ new URL('../../packages/weapp-vite/dist/config.mjs', import.meta.url).href)

export default defineConfig({
  weapp: {
    // weapp-vite options
    srcRoot: 'miniprogram',
    pluginRoot: 'plugin',
  },
})
