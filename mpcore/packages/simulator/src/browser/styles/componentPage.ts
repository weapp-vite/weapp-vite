import type { BrowserVirtualFiles } from '../virtualFiles'
import { join } from 'pathe'
import { getComponentPageStyleIsolation, isComponentPageInstance } from '../../host/componentPageAttachment'
import { readBrowserVirtualFile } from '../virtualFiles'

/** 已确认的 Component 页面使用最终 JSON 覆盖定义选项，普通 Page 不参与组件隔离。 */
export function resolveBrowserComponentPageStyleIsolation(
  files: BrowserVirtualFiles,
  page: object,
  route: string,
  miniprogramRootPath: string,
): string | undefined {
  if (!isComponentPageInstance(page)) {
    return undefined
  }
  const definitionIsolation = getComponentPageStyleIsolation(page)
  const filename = `${route}.json`
  const source = readBrowserVirtualFile(files, join(miniprogramRootPath, filename))
  if (source === undefined) {
    return definitionIsolation
  }
  let config: unknown
  try {
    config = JSON.parse(source)
  }
  catch {
    throw new Error(`Invalid browser Component page JSON: ${filename}`)
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid browser Component page JSON: ${filename}`)
  }
  const isolation = 'styleIsolation' in config ? config.styleIsolation : undefined
  // null、false 等显式值也覆盖 JS 定义；仅 undefined 保留定义选项。
  return isolation === undefined ? definitionIsolation : typeof isolation === 'string' ? isolation : undefined
}
