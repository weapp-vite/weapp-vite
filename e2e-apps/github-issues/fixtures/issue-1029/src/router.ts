import { createRouter } from 'wevu/router'
import { routes } from 'wevu/router/auto-routes'

export const trace: Array<{ phase: string, to?: string, from?: string, title?: unknown }> = []
export const router = createRouter({ routes, initialNavigationMode: 'blocking' })

router.beforeEach(async (to, from) => {
  trace.push({ phase: 'before', to: to?.name, from: from.name, title: to?.meta?.title })
  await Promise.resolve()
  if (to?.query.action === 'abort') {
    return false
  }
  if (to?.query.action === 'redirect') {
    return { name: 'home', query: { redirected: 'yes' } }
  }
  trace.push({ phase: 'allowed', to: to?.name, from: from.name })
})
router.beforeResolve((to, from) => {
  trace.push({ phase: 'resolve', to: to?.name, from: from.name })
})
router.afterEach((to, from, failure) => {
  trace.push({ phase: failure ? 'failed' : 'after', to: to?.name, from: from.name })
})

export function snapshot() {
  const route = router.currentRoute
  return {
    route: { path: route.path, name: route.name ?? null, meta: route.meta ?? null, query: route.query },
    records: routes,
    trace: [...trace],
  }
}

export async function navigate(command: string) {
  let result
  switch (command) {
    case 'profile':
      result = await router.push({ name: 'profile', query: { source: 'home' } })
      break
    case 'abort':
      result = await router.push({ name: 'profile', query: { action: 'abort' } })
      break
    case 'redirect':
      result = await router.push({ name: 'profile', query: { action: 'redirect' } })
      break
    case 'back':
      result = await router.back()
      break
    case 'legacy':
      result = await router.push({ path: '/pages/legacy/index' })
      break
  }
  return { failureType: result?.type ?? null, ...snapshot() }
}
