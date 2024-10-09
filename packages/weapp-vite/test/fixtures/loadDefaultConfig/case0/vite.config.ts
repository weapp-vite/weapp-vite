import { defineConfig } from '../../../../src/config'
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