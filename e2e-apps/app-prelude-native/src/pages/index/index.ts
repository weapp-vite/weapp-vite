import { sharedRouteLabel } from '../../shared/runtime'

function resolvePreludeLog() {
  const app = getApp<{
    getPreludeLog?: () => string[]
  }>()

  return typeof app?.getPreludeLog === 'function'
    ? app.getPreludeLog()
    : []
}

Page({
  data: {
    route: 'main',
    sharedRouteLabel,
    preludeLog: resolvePreludeLog(),
  },
})
