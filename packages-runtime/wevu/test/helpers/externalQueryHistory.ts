import type { LocationQuery, RouteLocationNormalizedLoaded, RouterHistory } from 'wevu/router'

/**
 * 业务侧 query 存储：按 path 隔离，框架不感知其结构与生命周期。
 *
 * 键统一用规范化 path（不带前导斜杠），与 `readLocation` / `push` / `replace`
 * 拿到的 `route.path` 同源，因此切页再返回时各页读回自己的 query。
 */
export interface QueryStore {
  /** 读取指定 path 的 query；undefined 表示该 path 尚未写入。 */
  get: (path: string) => LocationQuery | undefined
  /** 写入指定 path 的 query。 */
  set: (path: string, query: LocationQuery) => void
  /** 清空 query：传 path 只清该 path，不传清空全部。 */
  clear: (path?: string) => void
}

/** 创建业务侧 query 存储。 */
export function createQueryStore(): QueryStore {
  const queries = new Map<string, LocationQuery>()
  return {
    get: path => queries.get(path),
    set: (path, next) => {
      queries.set(path, { ...next })
    },
    clear: (path) => {
      if (path === undefined) {
        queries.clear()
        return
      }
      queries.delete(path)
    },
  }
}

/** 外置 query 驱动与它的外部变更通知入口。 */
export interface ExternalQueryHistory {
  /** 交给 createRouter 的历史驱动。 */
  readonly history: RouterHistory
  /** 业务侧在导航之外改写存储后，通知路由刷新快照。 */
  readonly notify: () => void
}

/**
 * 用例：query 外置存取的 history 驱动。
 *
 * 应用的「位置」只含 path：query 存在业务存储里，原生 URL 不带 query。
 * 框架只提供读取、校验、提交与通知四个原语，其余语义由应用决定。
 */
export function createExternalQueryHistory(store: QueryStore): ExternalQueryHistory {
  let notify: (() => void) | undefined
  const history: RouterHistory = {
    create(context) {
      const { defaultHistory, resolve } = context
      notify = () => context.notifyLocationChange()
      /**
       * 提交一次导航：同页只写业务存储；跨页委托原生导航，成功后才写存储。
       *
       * 原生 URL 只带 path：交给 defaultHistory 前投影掉 query，并用 resolve
       * 补全为规范位置，这样业务 query 不会拼进原生 URL。
       */
      const write = async (
        mode: 'push' | 'replace',
        to: RouteLocationNormalizedLoaded,
        from: RouteLocationNormalizedLoaded,
      ) => {
        const failure = to.path === from.path
          ? undefined
          : await defaultHistory[mode](resolve({ path: to.path, hash: to.hash }), from)
        if (!failure) {
          store.set(to.path, to.query)
        }
        return failure
      }
      return {
        /** 读取：query 来自业务存储的该 path 条目；该 path 尚未写入时沿用宿主 query。 */
        readLocation: location => resolve({
          path: location.path,
          query: store.get(location.path) ?? location.query,
          hash: location.hash,
        }),
        /**
         * 只用于替换平台校验：同页 query 变更与 tab 携带 query 必须放行。
         * 业务拦截交给 `beforeEach` / `beforeResolve` 等守卫，那里已能看到自存储 query。
         */
        check: () => undefined,
        push: (to, from) => write('push', to, from),
        replace: (to, from) => write('replace', to, from),
      }
    },
  }
  return {
    history,
    notify: () => notify?.(),
  }
}
