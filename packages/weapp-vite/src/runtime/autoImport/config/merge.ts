import type { AutoImportComponents, AutoImportComponentsOption } from '../../types'

export function cloneAutoImportComponents(config?: AutoImportComponentsOption | null): AutoImportComponents | undefined {
  if (config === false || !config) {
    return undefined
  }

  const cloned: AutoImportComponents = {}
  if (config.globs?.length) {
    cloned.globs = [...config.globs]
  }
  if (config.resolvers?.length) {
    cloned.resolvers = [...config.resolvers]
  }
  if (config.output !== undefined) {
    cloned.output = config.output
  }
  if (config.typedComponents !== undefined) {
    cloned.typedComponents = config.typedComponents
  }
  if (config.htmlCustomData !== undefined) {
    cloned.htmlCustomData = config.htmlCustomData
  }
  if (config.vueComponents !== undefined) {
    cloned.vueComponents = config.vueComponents
  }
  if (config.vueComponentsModule !== undefined) {
    cloned.vueComponentsModule = config.vueComponentsModule
  }
  return cloned
}

function mergeGlobs(base?: string[], extra?: string[]) {
  const values = [
    ...(base ?? []),
    ...(extra ?? []),
  ]
    .map(entry => entry?.trim())
    .filter((entry): entry is string => Boolean(entry))

  if (!values.length) {
    return undefined
  }
  const deduped: string[] = []
  const seen = new Set<string>()
  for (const entry of values) {
    if (seen.has(entry)) {
      continue
    }
    seen.add(entry)
    deduped.push(entry)
  }
  return deduped
}

function mergeResolvers(
  base?: AutoImportComponents['resolvers'],
  extra?: AutoImportComponents['resolvers'],
) {
  const merged = [
    ...(base ?? []),
    ...(extra ?? []),
  ].filter(Boolean)
  return merged.length ? merged : undefined
}

export function mergeAutoImportComponents(
  lower?: AutoImportComponents,
  upper?: AutoImportComponents,
  preferUpperScalars = false,
): AutoImportComponents | undefined {
  if (!lower && !upper) {
    return undefined
  }
  if (!lower) {
    return cloneAutoImportComponents(upper)
  }
  if (!upper) {
    return cloneAutoImportComponents(lower)
  }

  const merged: AutoImportComponents = {}
  const globs = mergeGlobs(lower.globs, upper.globs)
  if (globs) {
    merged.globs = globs
  }
  const resolvers = mergeResolvers(lower.resolvers, upper.resolvers)
  if (resolvers) {
    merged.resolvers = resolvers
  }

  const pickScalar = <T>(baseline: T | undefined, candidate: T | undefined) => {
    return preferUpperScalars ? (candidate ?? baseline) : (baseline ?? candidate)
  }

  const output = pickScalar(lower.output, upper.output)
  if (output !== undefined) {
    merged.output = output
  }
  const typedComponents = pickScalar(lower.typedComponents, upper.typedComponents)
  if (typedComponents !== undefined) {
    merged.typedComponents = typedComponents
  }
  const htmlCustomData = pickScalar(lower.htmlCustomData, upper.htmlCustomData)
  if (htmlCustomData !== undefined) {
    merged.htmlCustomData = htmlCustomData
  }
  const vueComponents = pickScalar(lower.vueComponents, upper.vueComponents)
  if (vueComponents !== undefined) {
    merged.vueComponents = vueComponents
  }
  const vueComponentsModule = pickScalar(lower.vueComponentsModule, upper.vueComponentsModule)
  if (vueComponentsModule !== undefined) {
    merged.vueComponentsModule = vueComponentsModule
  }
  return merged
}
