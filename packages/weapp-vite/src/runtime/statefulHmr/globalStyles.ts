import type { StatefulHmrOutputFile } from './outputWriter'
import { Buffer } from 'node:buffer'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import { changeFileExtension } from '../../utils/file'

/** 将全局样式放在同目录资产，避免微信直接修改 app.wxss 时完整重启。 */
export function createStatefulHmrGlobalStyleAssets(
  output: StatefulHmrOutputFile[],
  styleExtension: string,
  options: { createIfMissing?: boolean } = {},
): StatefulHmrOutputFile[] {
  const entryFile = changeFileExtension('app', styleExtension)
  const styleFile = changeFileExtension(WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME, styleExtension)
  const entry = output.find(item => item.type === 'asset' && item.fileName === entryFile)
  if (!entry && !options.createIfMissing) {
    return output
  }
  const entrySource = `@import "./${styleFile}";\n`
  const existingStyle = output.find(item => item.fileName === styleFile)
  if (existingStyle) {
    if (entry?.type === 'asset' && Buffer.from(entry.source).toString('utf8') === entrySource) {
      return output
    }
    throw new Error(`Stateful HMR global stylesheet conflicts with emitted asset: ${styleFile}`)
  }
  const styleSource = entry?.type === 'asset' ? entry.source : ''
  return [
    ...output.filter(item => item !== entry),
    { type: 'asset', fileName: entryFile, source: entrySource },
    { type: 'asset', fileName: styleFile, source: styleSource },
  ]
}
