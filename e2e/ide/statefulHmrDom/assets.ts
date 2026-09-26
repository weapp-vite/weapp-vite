import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { expect } from 'vitest'
import { replaceFileByRename } from '../../utils/hmr-helpers'

/** 资产生命周期不应替换页面实例或丢失输入，最终点击仍使用原始事件逻辑。 */
export function assetLifecycleCheckpoints(): DomCheckpoint[] {
  return ['prepared', 'created', 'edited', 'deleted', 'restored', 'repeated', 'incremented'].map(id => ({
    id,
    route: '/pages/native/index',
    action: `验证资产生命周期 ${id} 的页面状态`,
    nodes: [
      { selector: '.count', text: id === 'incremented' ? '3' : '2' },
      { selector: '.input', attributes: { value: 'held-input' } },
      { selector: '.marker', text: 'STATEFUL-NATIVE-BASE' },
    ],
  }))
}

export async function verifyAssetLifecycle(options: {
  appRoot: string
  check: (id: string) => Promise<void>
  increment: () => Promise<void>
}) {
  const assets = [
    { source: 'src/resources/ownership-lifecycle.png', output: 'resources/ownership-lifecycle.png' },
    { source: 'public/ownership-lifecycle.data', output: 'ownership-lifecycle.data' },
  ]
  const verify = async (content?: string) => {
    for (const asset of assets) {
      const output = path.join(options.appRoot, 'dist', asset.output)
      await expect.poll(() => fs.readFile(output, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          return undefined
        }
        throw error
      }), { timeout: 30_000, interval: 100 }).toBe(content)
    }
  }
  const write = async (content: string) => {
    for (const asset of assets) {
      const source = path.join(options.appRoot, asset.source)
      await fs.ensureDir(path.dirname(source))
      await replaceFileByRename(source, content)
    }
    await verify(content)
  }
  try {
    await options.check('prepared')
    await write('asset-original')
    await options.check('created')
    await write('asset-edited')
    await options.check('edited')
    for (const asset of assets) {
      await fs.remove(path.join(options.appRoot, asset.source))
    }
    await verify()
    await options.check('deleted')
    await write('asset-original')
    await options.check('restored')
    await write('asset-second-edit')
    await write('asset-original')
    await options.check('repeated')
    await options.increment()
    await options.check('incremented')
  }
  finally {
    for (const asset of assets) {
      await fs.remove(path.join(options.appRoot, asset.source))
    }
    await verify()
  }
}
