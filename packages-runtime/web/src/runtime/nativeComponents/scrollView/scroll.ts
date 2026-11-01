import { readBooleanAttribute } from '../helpers'

const synchronousTargets = new WeakMap<HTMLDivElement, { top: number, left: number }>()

/** 所有程序化定位共用双轴入口，避免分别滚动时后一次取消前一次动画。 */
export function scrollViewport(host: Element, viewport: HTMLDivElement, position: { top?: number, left?: number }) {
  // 同一次模板提交的两个属性依次赋值时，平滑滚动尚未推进当前位置。
  const previous = synchronousTargets.get(viewport)
  const target = {
    top: position.top ?? previous?.top ?? viewport.scrollTop,
    left: position.left ?? previous?.left ?? viewport.scrollLeft,
  }
  synchronousTargets.set(viewport, target)
  queueMicrotask(() => {
    if (synchronousTargets.get(viewport) === target) {
      synchronousTargets.delete(viewport)
    }
  })
  viewport.scrollTo({
    ...target,
    behavior: readBooleanAttribute(host, 'scroll-with-animation') ? 'smooth' : 'auto',
  })
}
