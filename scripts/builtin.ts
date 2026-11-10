import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { components } from '../packages-runtime/wevu-compiler/src/auto-import-components/builtin.auto'
import { updateBuiltinComponents } from './builtin/index'

const outputFile = fileURLToPath(new URL('../packages-runtime/wevu-compiler/src/auto-import-components/builtin.auto.ts', import.meta.url))

updateBuiltinComponents({
  previousComponents: components,
  writeSource: source => writeFile(outputFile, source),
}).catch((error: unknown) => {
  console.error('[wechat-builtins] generation failed')
  console.error(error)
  process.exitCode = 1
})
