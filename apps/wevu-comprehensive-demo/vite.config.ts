import { defineConfig } from 'weapp-vite/config'

export default defineConfig(() => ({
  weapp: {
    srcRoot: 'src',  // 源代码目录
  },
  // weapp-vite 内置的 Vue 支持会自动处理 .vue 文件，不需要额外插件
}))
