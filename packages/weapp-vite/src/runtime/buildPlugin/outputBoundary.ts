import { Buffer } from 'node:buffer'

const rollupVisualizerTitle = '<title>Rollup Visualizer</title>'

/** 构建分析报告由插件消费，不属于小程序运行时资产。 */
export function isBundlerDiagnosticAsset(
  output: { type: string, fileName: string, source?: string | Uint8Array },
): boolean {
  if (output.type !== 'asset' || !output.fileName.toLowerCase().endsWith('.html') || output.source === undefined) {
    return false
  }
  const source = typeof output.source === 'string'
    ? output.source
    : Buffer.from(output.source).toString('utf8')
  return source.includes(rollupVisualizerTitle)
}
