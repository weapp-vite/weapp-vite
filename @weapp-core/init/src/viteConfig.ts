/**
 * @description 生成默认的 vite.config.ts 模板
 */
export function getDefaultViteConfig() {
  return `import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    // weapp-vite options
  },
})
`
}
