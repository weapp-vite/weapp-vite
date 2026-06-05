export interface DefaultViteConfigOptions {
  srcRoot?: string
}

/**
 * @description 生成默认的 vite.config.ts 模板
 */
export function getDefaultViteConfig(options: DefaultViteConfigOptions = {}) {
  const { srcRoot = 'src' } = options
  const srcRootLine = srcRoot === 'src'
    ? '    // weapp-vite options'
    : `    srcRoot: '${srcRoot}',`

  return `import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
${srcRootLine}
  },
})
`
}
