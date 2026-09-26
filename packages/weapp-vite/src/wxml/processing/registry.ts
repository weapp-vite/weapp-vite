export type TemplateDependencies = Map<string, Set<string>>
export type ProcessingStage = 'transform' | 'validate'

export interface WxmlDependencyRegistry {
  dependencies: Map<string, TemplateDependencies>
  pending: Map<symbol, { scope: string, stage: ProcessingStage, templates: TemplateDependencies }>
  failed: Map<string, TemplateDependencies>
  references: Map<string, number>
  listeners: Set<(files: string[]) => void>
}

/** 引用计数同时覆盖已发布、在途和失败恢复集合，单次注册不扫描整个工程。 */
export function retainDependency(state: WxmlDependencyRegistry, files: Set<string>, file: string) {
  if (files.has(file)) {
    return
  }
  files.add(file)
  const count = state.references.get(file) ?? 0
  state.references.set(file, count + 1)
  if (!count) {
    for (const listener of state.listeners) {
      listener([file])
    }
  }
}

export function releaseDependencies(state: WxmlDependencyRegistry, templates: TemplateDependencies) {
  for (const files of templates.values()) {
    for (const file of files) {
      const count = state.references.get(file)!
      if (count === 1) {
        state.references.delete(file)
      }
      else {
        state.references.set(file, count - 1)
      }
    }
  }
}

/** 只释放成功覆盖的模板，局部恢复不能丢失其他失败模板的监听。 */
export function releaseCoveredDependencies(state: WxmlDependencyRegistry, templates: TemplateDependencies, covered?: TemplateDependencies) {
  if (!covered) {
    releaseDependencies(state, templates)
    templates.clear()
    return
  }
  for (const name of covered.keys()) {
    const files = templates.get(name)
    if (files) {
      releaseDependencies(state, new Map([[name, files]]))
      templates.delete(name)
    }
  }
}
