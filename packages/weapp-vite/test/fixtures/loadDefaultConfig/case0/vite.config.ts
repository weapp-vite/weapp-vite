import { defineConfig } from '../../../../src/config'
import path from 'path'
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