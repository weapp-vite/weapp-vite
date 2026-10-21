import path from 'node:path'
import process from 'node:process'
import { loadConfigFromFile } from 'vite'

/** 分片只收集局部覆盖率；完整阈值由使用原配置的合并阶段执行一次。 */
export default async function coverageShardConfig() {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path.resolve(process.cwd(), 'vitest.config.mts'))
  if (!loaded) {
    throw new Error('Missing root Vitest configuration')
  }
  const config = loaded.config
  return { ...config, test: { ...config.test, coverage: { ...config.test?.coverage, thresholds: undefined } } }
}
