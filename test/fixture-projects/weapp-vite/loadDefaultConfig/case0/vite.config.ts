import { defineConfig } from 'weapp-vite'
import path from 'pathe'
export default defineConfig({
  weapp: {
    srcRoot: 'src',
    jsonAlias: {
      entries: [
        {
          find: '@',
          replacement: path.join('project-root', 'src'),
        },
      ]
    }
  }
})
