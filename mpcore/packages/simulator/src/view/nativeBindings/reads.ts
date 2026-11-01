import type { TemplateValueSource } from './sources'
import { pathsIntersect } from './commits'
import { getTemplateMissingSources, getTemplateObjectSources, getTemplatePropertySources, setTemplateMissingSources, setTemplatePropertySources } from './sources'

interface Reads {
  root: Record<string, unknown>
  values: WeakMap<object, TemplateValueSource>
  paths: Map<string, string[]>
}

const reads = new WeakMap<object, Reads>()

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function findObjectPaths(root: Record<string, unknown>, target: object) {
  const found: string[][] = []
  const active = new WeakSet<object>()
  const visit = (value: unknown, path: string[]) => {
    if (!object(value) || active.has(value)) {
      return
    }
    if (value === target) {
      found.push(path)
      return
    }
    active.add(value)
    for (const key of Object.keys(value)) {
      visit(value[key], [...path, key])
    }
    active.delete(value)
  }
  visit(root, [])
  return found
}

function addPaths(capture: Reads, paths: readonly string[][]) {
  for (const path of paths) {
    for (const [previousKey, previous] of capture.paths) {
      if (previous.length < path.length && pathsIntersect(previous, path)) {
        capture.paths.delete(previousKey)
      }
    }
    capture.paths.set(JSON.stringify(path), path)
  }
}

function valueSource(capture: Reads, value: unknown): TemplateValueSource {
  const base = object(value) ? capture.values.get(value) : undefined
  const fields = base?.fields ?? (object(value) ? getTemplateObjectSources(value, capture.root) : undefined)
  const missing = base?.missing ?? (object(value) ? getTemplateMissingSources(value, capture.root) : undefined)
  const paths = [...capture.paths.values()]
  const direct = [...(base?.paths ?? []), ...[...(fields?.values() ?? [])].flatMap(field => field.paths)]
  const controls = paths.filter(path => !direct.some(parent => pathsIntersect(path, parent)))
  return { ...base, fields, missing, paths, controls: [...(base?.controls ?? []), ...controls] }
}

function propertySource(capture: Reads, target: unknown, key: string | number): TemplateValueSource {
  if (!object(target)) {
    return { paths: [...capture.paths.values()] }
  }
  const base = capture.values.get(target)
  const known = base?.fields?.get(String(key)) ?? base?.missing?.(String(key)) ?? getTemplatePropertySources(target, key, capture.root)
  const controls = base?.controls ?? []
  if (known) {
    return { ...known, paths: [...known.paths, ...controls], controls: [...(known.controls ?? []), ...controls] }
  }
  const parents = base?.addresses ?? (base?.fields ? [] : findObjectPaths(capture.root, target))
  const addresses = parents.map(path => [...path, String(key)])
  return { paths: [...addresses, ...controls], addresses, controls }
}

/** 解释器读取原始值时记录来源，不用 Proxy 改变对象身份或 WXS 参数。 */
export function recordTemplateValueRead(source: object, value: unknown, key: string | number, target?: unknown) {
  const capture = reads.get(source)
  if (!capture) {
    return
  }
  let origin: TemplateValueSource
  if (target === undefined) {
    const known = getTemplatePropertySources(source, key, capture.root)
    const paths = Object.hasOwn(capture.root, key) && Object.is(capture.root[key], value)
      ? [[String(key)]]
      : findObjectPaths(capture.root, source).map(path => [...path, String(key)])
    origin = known ?? { paths, addresses: paths }
  }
  else {
    origin = propertySource(capture, target, key)
  }
  if (object(value)) {
    capture.values.set(value, origin)
  }
  addPaths(capture, origin.paths)
}

export function recordTemplateDependencies(source: object, paths: string[][]) {
  const capture = reads.get(source)
  if (capture) {
    addPaths(capture, paths)
  }
}

/** 字面量逐字段保留来源，后续读取一个字段不会消费兄弟字段。 */
export function recordTemplatePropertyRead(source: object, target: object, key: string | number, origin: TemplateValueSource) {
  const capture = reads.get(source)
  if (capture) {
    setTemplatePropertySources(target, key, capture.root, origin)
  }
}

/** Spread 未提供的字段也保留按键依赖，后续同值覆盖不会丢失原生命令。 */
export function recordTemplateSpreadRead(
  source: object,
  target: object,
  spread: { value: Record<string, unknown>, source: TemplateValueSource, propertySource: (key: string) => TemplateValueSource },
) {
  const capture = reads.get(source)
  if (!capture) {
    return
  }
  const merge = (previous: TemplateValueSource | undefined, incoming: TemplateValueSource): TemplateValueSource => ({
    ...previous,
    paths: [...(previous?.paths ?? []), ...incoming.paths],
    controls: [...(previous?.controls ?? []), ...incoming.paths],
  })
  for (const [key, previous] of getTemplateObjectSources(target, capture.root) ?? []) {
    if (!Object.hasOwn(spread.value, key)) {
      setTemplatePropertySources(target, key, capture.root, merge(previous, spread.propertySource(key)))
    }
  }
  const previous = getTemplateMissingSources(target, capture.root)
  setTemplateMissingSources(target, capture.root, key => merge(previous?.(key), spread.propertySource(key)))
  const base = capture.values.get(target)
  capture.values.set(target, {
    ...base,
    paths: [...(base?.paths ?? []), ...spread.source.paths],
    fields: getTemplateObjectSources(target, capture.root),
    missing: getTemplateMissingSources(target, capture.root),
  })
}

export function recordTemplateControlRead(source: object, value: unknown, paths: string[][]) {
  const capture = reads.get(source)
  if (capture && object(value)) {
    const base = capture.values.get(value) ?? { paths: [], fields: getTemplateObjectSources(value, capture.root), missing: getTemplateMissingSources(value, capture.root) }
    capture.values.set(value, { ...base, controls: [...(base.controls ?? []), ...paths] })
  }
}

export function captureTemplateValueReads<T>(source: object, read: () => T, merge = true) {
  const parent = reads.get(source)
  const capture = parent && { ...parent, paths: new Map<string, string[]>() }
  if (capture) {
    reads.set(source, capture)
  }
  try {
    const value = read()
    const origin = capture ? valueSource(capture, value) : { paths: [] }
    if (capture && object(value)) {
      capture.values.set(value, origin)
    }
    return {
      value,
      source: origin,
      propertySource: (key: string | number) => capture ? propertySource(capture, value, key) : { paths: [] },
    }
  }
  finally {
    if (parent && capture) {
      reads.set(source, parent)
      if (merge) {
        addPaths(parent, [...capture.paths.values()])
      }
    }
  }
}

export function captureTemplateReads<T>(source: object, root: Record<string, unknown>, read: () => T) {
  const previous = reads.get(source)
  const capture: Reads = { root, values: new WeakMap(), paths: new Map() }
  reads.set(source, capture)
  try {
    const value = read()
    const origin = valueSource(capture, value)
    if (object(value)) {
      capture.values.set(value, origin)
    }
    return { value, paths: origin.paths, propertySource: (key: string | number) => propertySource(capture, value, key) }
  }
  finally {
    if (previous) {
      reads.set(source, previous)
    }
    else {
      reads.delete(source)
    }
  }
}
