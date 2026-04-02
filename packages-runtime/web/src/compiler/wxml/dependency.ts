import type { WxmlDependencyContext } from './types'

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
