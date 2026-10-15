import type { ImportEntry, IncludeEntry, WxmlDependencyContext, WxsEntry } from './types'

export function createDependencyContext(): WxmlDependencyContext {
  return {
    warnings: [],
    dependencies: [],
    dependencySet: new Set(),
    visited: new Set(),
    active: new Set(),
    circularWarnings: new Set(),
  }
}

export function addDependency(
  value: string,
  context: WxmlDependencyContext,
  direct?: string[],
) {
  if (!context.dependencySet.has(value)) {
    context.dependencySet.add(value)
    context.dependencies.push(value)
    direct?.push(value)
  }
}

/** 依赖扫描完成分析后，按编译器的分组顺序登记直接依赖。 */
export function collectDependencies(
  entries: { imports: ImportEntry[], includes: IncludeEntry[], wxs: WxsEntry[] },
  context: WxmlDependencyContext,
) {
  const dependencies: string[] = []
  for (const entry of entries.imports) {
    addDependency(entry.id, context, dependencies)
  }
  for (const entry of entries.includes) {
    addDependency(entry.id, context, dependencies)
  }
  for (const entry of entries.wxs) {
    if (entry.kind === 'src') {
      addDependency(entry.value, context, dependencies)
    }
  }
  return dependencies
}

export function warnReadTemplate(context: WxmlDependencyContext, target: string) {
  context.warnings.push(`[web] 无法读取模板依赖: ${target}`)
}

export function warnCircularTemplate(
  context: WxmlDependencyContext,
  from: string,
  target: string,
) {
  const key = `${from}=>${target}`
  if (context.circularWarnings.has(key)) {
    return
  }
  context.circularWarnings.add(key)
  context.warnings.push(`[web] WXML 循环引用: ${from} -> ${target}`)
}
