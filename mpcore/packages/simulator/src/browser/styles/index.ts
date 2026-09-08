import type { Root } from 'postcss'
import type { BrowserVirtualFiles } from '../virtualFiles'
import { posix } from 'pathe'
import postcss from 'postcss'
import { normalizeBrowserFilePath, readBrowserVirtualFile } from '../virtualFiles'

export interface BrowserPageStyles {
  /** 按实际遍历顺序去重的项目相对样式依赖。 */
  dependencies: string[]
  /** 已展开本地导入的页面 CSS；不包含嵌套组件样式隔离转换。 */
  cssText: string
  /** Component 页面的 page-* 隔离选项可关闭隐式 app.wxss。 */
  appWxssEnabled: boolean
}

const IMPORT_RE = /^(?:"([^"]+)"|'([^']+)'|url\(\s*(?:"([^"]+)"|'([^']+)'|([^'"()\s]+))\s*\))(?:\s+(\S[\s\S]*))?$/i
const PAGE_ISOLATION = new Set(['page-isolated', 'page-strong-isolated', 'page-apply-shared', 'page-shared'])

/** 读取当前文件内容并展开页面样式依赖，保持 app 在前、页面声明在后的层叠顺序。 */
export function resolveBrowserPageStyles(
  files: BrowserVirtualFiles,
  route: string,
  options: { miniprogramRootPath?: string, styleIsolation?: string } = {},
): BrowserPageStyles {
  const root = normalizeBrowserFilePath(options.miniprogramRootPath ?? '')
  const dependencies = new Set<string>()
  const appWxssEnabled = !PAGE_ISOLATION.has(options.styleIsolation ?? '')
  const label = (filename: string) => posix.relative(root || '.', filename)

  function visit(filename: string, stack: string[]): Root {
    const source = readBrowserVirtualFile(files, filename)
    if (source === undefined) {
      throw new Error(`Missing browser WXSS dependency: ${label(filename)} (import chain: ${[...stack, filename].map(label).join(' -> ')})`)
    }
    if (stack.includes(filename)) {
      throw new Error(`Circular browser WXSS import: ${[...stack, filename].map(label).join(' -> ')}`)
    }
    dependencies.add(label(filename))
    let stylesheet: Root
    try {
      stylesheet = postcss.parse(source)
    }
    catch {
      throw new Error(`Invalid browser WXSS syntax: ${label(filename)}`)
    }
    stylesheet.walkAtRules(/^import$/i, (rule) => {
      const match = rule.params.match(IMPORT_RE)
      const target = (match?.[1] ?? match?.[2] ?? match?.[3] ?? match?.[4] ?? match?.[5])?.trim()
      const media = match?.[6]?.trim()
      if (!target || target.includes('\\') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target) || (media && /^(?:layer|supports)\b/i.test(media))) {
        throw new Error(`Unsupported browser WXSS import: ${label(filename)}`)
      }
      const pathname = target.split(/[?#]/, 1)[0]!
      const dependency = normalizeBrowserFilePath(posix.join(target.startsWith('/') ? root : posix.dirname(filename), pathname.replace(/^\/+/, '')))
      const relative = label(dependency)
      if (!pathname || relative === '..' || relative.startsWith('../')) {
        throw new Error(`Browser WXSS import escapes project root: ${label(filename)}`)
      }
      const imported = visit(dependency, [...stack, filename])
      if (media) {
        const wrapper = postcss.atRule({ name: 'media', params: media })
        wrapper.append(imported.nodes)
        rule.replaceWith(wrapper)
      }
      else {
        rule.replaceWith(...imported.nodes)
      }
    })
    return stylesheet
  }

  const entries = [
    ...(appWxssEnabled ? [posix.join(root, 'app.wxss')] : []),
    posix.join(root, `${route}.wxss`),
  ]
  const cssText = entries
    .filter(filename => readBrowserVirtualFile(files, filename) !== undefined)
    .map(filename => visit(normalizeBrowserFilePath(filename), []).toString())
    .join('\n')
  return { appWxssEnabled, cssText, dependencies: [...dependencies] }
}
