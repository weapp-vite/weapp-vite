import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { rolldown } from 'rolldown'

/** 验收宿主通过显式导入消费冻结产物，不继承源码工程的受管 TypeScript 配置。 */
export async function bundleBrowserRuntime(source: string, directory: string) {
  const browserEntry = path.join(directory, 'entry.ts')
  await writeFile(browserEntry, source)
  const bundle = await rolldown({ input: browserEntry, platform: 'browser', tsconfig: false })
  try {
    const file = path.join(directory, 'corpus.js')
    await bundle.write({ file, format: 'iife' })
    return await readFile(file, 'utf8')
  }
  finally {
    await bundle.close()
  }
}
