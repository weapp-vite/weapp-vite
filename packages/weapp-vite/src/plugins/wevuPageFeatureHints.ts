import { WEAPP_VITE_RUNTIME_VIRTUAL_IDS } from '@weapp-core/constants'

const WEVU_RUNTIME_MODULE_HINTS = [
  '\'wevu\'',
  '"wevu"',
  '\'wevu/internal-runtime\'',
  '"wevu/internal-runtime"',
  ...Object.values(WEAPP_VITE_RUNTIME_VIRTUAL_IDS)
    .flatMap(moduleId => [`'${moduleId}'`, `"${moduleId}"`]),
]

const PAGE_FEATURE_HOOK_HINTS = [
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onRouteDone',
  'onTabItemTap',
  'onResize',
  'onShareAppMessage',
  'onShareTimeline',
  'onAddToFavorites',
  'onSaveExitState',
]

export function mayNeedWevuPageFeatureAnalysis(code: string) {
  return WEVU_RUNTIME_MODULE_HINTS.some(hint => code.includes(hint))
    || PAGE_FEATURE_HOOK_HINTS.some(hint => code.includes(hint))
}
