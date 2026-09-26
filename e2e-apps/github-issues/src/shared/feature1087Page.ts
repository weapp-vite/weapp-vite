import { usePageScrollRestoration } from 'wevu/router'
import { getFeature1087Controller } from './feature1087'

/** 验证编译器沿普通 TS helper 收集页面滚动 hook，而不是依赖页面显式声明开关。 */
export function useFeature1087PageScroll() {
  return usePageScrollRestoration({ controller: getFeature1087Controller() })
}
