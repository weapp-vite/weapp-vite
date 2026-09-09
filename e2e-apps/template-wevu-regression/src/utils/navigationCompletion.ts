import type { NavigationFailure } from 'wevu/router'
import { isNavigationFailure } from 'wevu/router'

/** 保存点击发起的同一次导航，供回归测试在切走页面前等待宿主完成回调。 */
export function createNavigationCompletion(push: (path: string) => Promise<void | NavigationFailure>) {
  let navigation: { path: string, promise: Promise<void | NavigationFailure> } | undefined

  function pushTo(path: string) {
    const promise = push(path)
    navigation = { path, promise }
    return promise
  }

  async function waitForNavigation(expectedPath: string) {
    const current = navigation
    if (!current) {
      throw new Error('No portal navigation has started')
    }
    if (current.path !== expectedPath) {
      throw new Error(`Portal navigation target mismatch: expected ${expectedPath}, received ${current.path}`)
    }
    const result = await current.promise
    if (isNavigationFailure(result)) {
      throw result
    }
    return current.path
  }

  return { pushTo, waitForNavigation }
}
