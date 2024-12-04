import type { CreateResolver } from './types'

// https://tdesign.tencent.com/miniprogram/components/button
export const TDesignResolver: CreateResolver = () => {
  const prefix = 't-'
  const components: string[] = [
    // 基础
    'button',
    'divider',
    'fab',
    'icon',
    'row',
    'col',
    'link',
    // 导航
    'back-top',
    'drawer',
    'indexes',
    'indexes-anchor',
    'navbar',
    'side-bar',
    'side-bar-item',
    'steps',
    'step-item',
    'tab-bar',
    'tab-bar-item',
    'tabs',
    'tab-panel',
    // 输入
    'calendar',
    'cascader',
    'checkbox',
    'checkbox-group',
    'color-picker',
    'date-time-picker',
    'input',
    'picker',
    'picker-item',
    'radio',
    'radio-group',
    'rate',
    'search',
    'slider',
    'stepper',
    'switch',
    'textarea',
    'tree-select',
    'upload',
    // 数据展示
    'avatar',
    'avatar-group',
    'badge',
    'cell',
    'cell-group',
    'collapse',
    'collapse-panel',
    'count-down',
    'empty',
    'footer',
    'grid',
    'grid-item',
    'image',
    'image-viewer',
    'progress',
    'result',
    'skeleton',
    'sticky',
    'swiper',
    'swiper-nav',
    'tag',
    'check-tag',
    // 反馈
    'action-sheet',
    'dialog',
    'dropdown-menu',
    'dropdown-item',
    'guide',
    'loading',
    'message',
    'notice-bar',
    'overlay',
    'popup',
    'pull-down-refresh',
    'swipe-cell',
  ]
  const map = components.reduce<Record<string, string>>((acc, cur) => {
    acc[`${prefix}${cur}`] = `tdesign-miniprogram/${cur}/${cur}`
    return acc
  }, {})
  return (componentName) => {
    const from = map[componentName]
    if (from) {
      return {
        name: componentName,
        from,
      }
    }
  }
}
