import type { CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import path from 'pathe'
import { changeFileExtension } from '../../utils'
import { parseCommentJson } from '../../utils/json'
import { scriptTags } from '../../wxml/remove/safety'
import { scanTemplate } from '../../wxml/remove/scan'

interface CompilerConfig {
  componentFramework?: unknown
  usingComponents?: Record<string, unknown>
  componentGenerics?: Record<string, boolean | { default?: unknown }>
}

/** 从最终配置推导编译器方言；运行时 glassEaselWebview 检测不能替代组件编译器配置。 */
export function collectXmlTemplates(ctx: CompilerContext, sources: ReadonlyMap<string, string>, subPackageMeta?: SubPackageMetaValue) {
  const templateExtension = ctx.configService?.outputExtensions?.wxml ?? 'wxml'
  const templateSuffix = `.${templateExtension}`
  const independentPrefix = subPackageMeta ? `${subPackageMeta.subPackage.root}/` : undefined
  const inScope = (fileName: string) => independentPrefix
    ? fileName.startsWith(independentPrefix)
    : ctx.scanService?.isMainPackageFileName(fileName) !== false

  const configs = new Map<string, CompilerConfig>()
  for (const [fileName, source] of sources) {
    if (!fileName.endsWith('.json')) {
      continue
    }
    const value: unknown = parseCommentJson(source)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      configs.set(fileName, value as CompilerConfig)
    }
  }
  // 独立分包可能先完成；已加载 app 配置仍是全局编译器开关的权威来源。
  const appConfig = ctx.scanService?.appEntry?.json
  if (!configs.has('app.json') && appConfig) {
    configs.set('app.json', { componentFramework: appConfig.componentFramework })
  }
  const scopes: Array<{ prefix: string, fileName: string, config: CompilerConfig }> = []
  const xmlTemplates = new Set<string>()
  for (const [fileName, config] of configs) {
    const basename = path.basename(fileName)
    if (basename === 'app.json' || basename === 'plugin.json') {
      scopes.push({ prefix: fileName.slice(0, -basename.length), fileName, config })
    }
    else if (inScope(fileName) && config.componentFramework === 'glass-easel') {
      xmlTemplates.add(changeFileExtension(fileName, templateExtension))
    }
  }
  // 独立插件配置形成自己的作用域，不能继承外层 app 的框架开关。
  scopes.sort((a, b) => b.prefix.length - a.prefix.length)
  for (const fileName of sources.keys()) {
    if (inScope(fileName) && fileName.endsWith(templateSuffix) && scopes.find(scope => fileName.startsWith(scope.prefix))?.config.componentFramework === 'glass-easel') {
      xmlTemplates.add(fileName)
    }
  }

  const addDependency = (owner: string, request: unknown, component: boolean) => {
    if (typeof request !== 'string' || !request || /^\w[\w-]*:\/\//.test(request)) {
      return
    }
    const resolved = path.resolve('/', path.dirname(owner), request).slice(1)
    const dependency = component ? `${resolved}${templateSuffix}` : changeFileExtension(resolved, templateExtension)
    if (inScope(dependency)) {
      xmlTemplates.add(dependency)
    }
  }
  const visitedGlobals = new Set<string>()
  // Set 的迭代覆盖传递依赖并天然终止循环；闭包仅从本次不可变输入视图推导。
  for (const fileName of xmlTemplates) {
    const owner = changeFileExtension(fileName, 'json')
    const scope = scopes.find(scope => fileName.startsWith(scope.prefix))
    const configOwners = [owner]
    if (scope && !independentPrefix && !visitedGlobals.has(scope.fileName)) {
      visitedGlobals.add(scope.fileName)
      configOwners.push(scope.fileName)
    }
    for (const configOwner of configOwners) {
      const config = configs.get(configOwner)
      for (const request of Object.values(config?.usingComponents ?? {})) {
        addDependency(configOwner, request, true)
      }
      for (const generic of Object.values(config?.componentGenerics ?? {})) {
        if (generic && typeof generic === 'object') {
          addDependency(configOwner, generic.default, true)
        }
      }
    }
    const source = sources.get(fileName)
    if (source?.includes('<import') || source?.includes('<include')) {
      // 复用词法边界，不能把 WXS 字符串中的伪 import/include 当成依赖。
      const { elements } = scanTemplate(source, fileName, scriptTags, false, 'xml')
      for (const element of elements) {
        if (element.tag !== 'import' && element.tag !== 'include') {
          continue
        }
        const src = element.attrs.find(attr => attr.name === 'src')
        if (src?.valueStart !== undefined && src.valueEnd !== undefined) {
          addDependency(fileName, source.slice(src.valueStart, src.valueEnd), false)
        }
      }
    }
  }
  return xmlTemplates
}
