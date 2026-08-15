import process from 'node:process'
import { runAlipayTemplateBuildSmoke } from './alipay-template-build-smoke'

runAlipayTemplateBuildSmoke({
  label: 'alipay-multi-platform-template-smoke',
  templateDirectory: 'weapp-vite-multi-platform-template',
}).catch((error) => {
  const detail = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[alipay-multi-platform-template-smoke] failed: ${detail}\n`)
  process.exitCode = 1
})
