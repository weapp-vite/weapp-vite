import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const emptyOutDir = process.env.ISSUE_997_EMPTY === 'false' ? false : undefined
export default {
  weapp: { srcRoot: 'src', pluginRoot: 'plugin' },
  build: { emptyOutDir },
  plugins: [{
    name: 'issue-997-preserved-output-probe',
    buildStart() {
      if (process.env.ISSUE_997_VERIFY_PRESERVED !== 'true') {
        return
      }
      for (const file of ['dist/app.json', 'dist/pages/index/index.wxml', 'dist-plugin/plugin.json', 'dist-plugin/index.js']) {
        if (!existsSync(path.join(import.meta.dirname, file))) {
          throw new Error(`issue #997: previous output disappeared before rebuild: ${file}`)
        }
      }
    },
  }],
}
