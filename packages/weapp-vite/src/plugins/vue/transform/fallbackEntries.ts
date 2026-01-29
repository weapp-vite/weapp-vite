import type { CompilerContext } from '../../../context'
import fs from 'fs-extra'
import path from 'pathe'
import { collectVuePages } from './collectVuePages'

export async function collectFallbackPageEntryIds(
  configService: CompilerContext['configService'],
  scanService: CompilerContext['scanService'],
): Promise<Set<string>> {
  // 后备处理：对未被 Vite 引用的页面 .vue 进行编译并发出产物
  let pageList: string[] = []
  if (scanService?.appEntry?.json?.pages?.length) {
    pageList = scanService.appEntry.json.pages
  }
  else {
    const appJsonPath = path.join(configService.cwd, 'dist', 'app.json')
    try {
      const appJsonContent = await fs.readFile(appJsonPath, 'utf-8')
      const appJson = JSON.parse(appJsonContent)
      pageList = appJson.pages || []
    }
    catch {
      // 忽略
    }
  }

  const collectedEntries = new Set<string>()
  pageList.forEach(p => collectedEntries.add(path.join(configService.absoluteSrcRoot, p)))

  const extraVueFiles = await collectVuePages(path.join(configService.absoluteSrcRoot, 'pages'))
  extraVueFiles.forEach(f => collectedEntries.add(f.slice(0, -4)))

  return collectedEntries
}
