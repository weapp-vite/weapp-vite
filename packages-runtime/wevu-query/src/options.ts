import type { QueryOptions, TaggedQueryKey, UntaggedQueryKey } from './core/types'

/** 为可复用查询定义关联缓存键和数据类型，不引入运行时包装。 */
export function defineQueryOptions<TData, TKey extends UntaggedQueryKey>(
  options: QueryOptions<TData, TKey>,
): Omit<QueryOptions<TData, TKey>, 'key'> & { key: TaggedQueryKey<TKey, TData> } {
  return options as Omit<QueryOptions<TData, TKey>, 'key'> & { key: TaggedQueryKey<TKey, TData> }
}
