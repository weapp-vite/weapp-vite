import type {
  InternalRuntimeState,
  MiniProgramBoundingClientRectResult,
  MiniProgramNodesRefFields,
  MiniProgramScrollOffsetResult,
  MiniProgramSelectorQuery,
} from './types'
import { getCurrentInstance, getCurrentSetupContext } from './hooks'
import { createSelectorQuery } from './templateRefs/helpers'

export interface UseSelectorQueryOptions {
  context?: InternalRuntimeState | null
}

export interface UseBoundingClientRectOptions extends UseSelectorQueryOptions {
  all?: boolean
}

export interface UseSelectorFieldsOptions extends UseSelectorQueryOptions {
  all?: boolean
  fields: MiniProgramNodesRefFields
}

export interface UseScrollOffsetOptions extends UseSelectorQueryOptions {
  all?: boolean
}

export interface UseAllBoundingClientRectOptions extends UseSelectorQueryOptions {
  all: true
}

export interface UseAllSelectorFieldsOptions extends UseSelectorQueryOptions {
  all: true
  fields: MiniProgramNodesRefFields
}

export interface UseAllScrollOffsetOptions extends UseSelectorQueryOptions {
  all: true
}

function resolveSetupContext<T extends InternalRuntimeState>(
  apiName: string,
  context?: T | null,
): T {
  const resolved = context ?? getCurrentInstance<T>()
  if (!resolved || !getCurrentSetupContext()) {
    throw new Error(`${apiName}() 必须在 setup() 的同步阶段调用`)
  }
  return resolved
}

function runSelectorQuery<T>(
  context: InternalRuntimeState,
  selector: string,
  all: boolean,
  apply: (nodesRef: any) => void,
): Promise<T | null> {
  const query = createSelectorQuery(context)
  if (!query || !selector) {
    return Promise.resolve(null)
  }

  const nodesRef = all ? query.selectAll(selector) : query.select(selector)
  apply(nodesRef)

  return new Promise((resolve) => {
    query.exec((res) => {
      const result = Array.isArray(res) ? res[0] : null
      resolve((result ?? null) as T | null)
    })
  })
}

/**
 * 创建绑定当前小程序实例的选择器查询工厂。
 */
export function useSelectorQuery(options: UseSelectorQueryOptions = {}) {
  const context = resolveSetupContext('useSelectorQuery', options.context)
  return (): MiniProgramSelectorQuery | null => createSelectorQuery(context)
}

/**
 * 创建绑定当前小程序实例的节点布局查询函数。
 */
export function useBoundingClientRect(
  options?: UseBoundingClientRectOptions & { all?: false },
): (selector: string) => Promise<MiniProgramBoundingClientRectResult | null>
export function useBoundingClientRect(
  options: UseAllBoundingClientRectOptions,
): (selector: string) => Promise<MiniProgramBoundingClientRectResult[] | null>
export function useBoundingClientRect(options: UseBoundingClientRectOptions = {}) {
  const context = resolveSetupContext('useBoundingClientRect', options.context)
  const all = options.all ?? false

  return (selector: string) => runSelectorQuery<
    MiniProgramBoundingClientRectResult | MiniProgramBoundingClientRectResult[]
  >(
    context,
    selector,
    all,
    nodesRef => nodesRef.boundingClientRect(),
  )
}

/**
 * 创建绑定当前小程序实例的节点字段查询函数。
 */
export function useSelectorFields(
  options: UseSelectorFieldsOptions & { all?: false },
): (selector: string) => Promise<Record<string, any> | null>
export function useSelectorFields(
  options: UseAllSelectorFieldsOptions,
): (selector: string) => Promise<Array<Record<string, any>> | null>
export function useSelectorFields(options: UseSelectorFieldsOptions) {
  const context = resolveSetupContext('useSelectorFields', options.context)
  const all = options.all ?? false

  return (selector: string) => runSelectorQuery(
    context,
    selector,
    all,
    nodesRef => nodesRef.fields(options.fields),
  )
}

/**
 * 创建绑定当前小程序实例的滚动位置查询函数。
 */
export function useScrollOffset(
  options?: UseScrollOffsetOptions & { all?: false },
): (selector: string) => Promise<MiniProgramScrollOffsetResult | null>
export function useScrollOffset(
  options: UseAllScrollOffsetOptions,
): (selector: string) => Promise<MiniProgramScrollOffsetResult[] | null>
export function useScrollOffset(options: UseScrollOffsetOptions = {}) {
  const context = resolveSetupContext('useScrollOffset', options.context)
  const all = options.all ?? false

  return (selector: string) => runSelectorQuery<
    MiniProgramScrollOffsetResult | MiniProgramScrollOffsetResult[]
  >(
    context,
    selector,
    all,
    nodesRef => nodesRef.scrollOffset(),
  )
}
