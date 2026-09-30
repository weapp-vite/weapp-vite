import type { EmittedAsset } from 'rolldown'
import type { ConfigService } from '../config/types'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { generateLibDts } from '../libDts'

/** 声明编译器仅写入会话临时目录，最终产物由宿主统一 emit/write。 */
export async function prepareLibDtsAssets(service: ConfigService, onWatchFile: (file: string) => void): Promise<EmittedAsset[]> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-lib-assets-'))
  const assets: EmittedAsset[] = []
  async function collect(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await collect(file)
      }
      else if (entry.isFile()) {
        assets.push({ type: 'asset', fileName: path.relative(temporaryRoot, file), source: await readFile(file) })
      }
    }
  }
  try {
    await generateLibDts({ ...service, outDir: temporaryRoot }, onWatchFile)
    await collect(temporaryRoot)
    return assets
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
