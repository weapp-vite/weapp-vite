import { initializePageRoutes } from '@weapp-vite/web/runtime'

export function initializePublicUnits(stage: 'legacy' | 'explicit' | 'reset', routes: string[]) {
  const runtime = { viewport: { mode: 'mini-program' as const, maxWidth: 400, desktopBreakpoint: 800 } }
  const rpx = { designWidth: 375, varName: '--public-legacy-rpx' }
  if (stage === 'legacy') {
    initializePageRoutes(routes, { rpx, runtime })
  }
  else if (stage === 'explicit') {
    initializePageRoutes(routes, {
      rpx,
      styleUnits: { useVariable: true, ratio: 0.5, rpxVar: '--public-selected-rpx', designWidth: 320 },
      runtime,
    })
  }
  else {
    initializePageRoutes(routes, { runtime })
  }
  const height = stage === 'legacy' ? 120 : stage === 'explicit' ? 160 : 200
  return {
    styleValue: `height:${height}rpx;width:50vw`,
    arrayValue: [{ width: `${height / 2}rpx` }, `height:${height}rpx`],
  }
}
