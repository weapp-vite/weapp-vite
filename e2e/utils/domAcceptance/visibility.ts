import type { DomNodeEvidence } from './types'

type LayoutEvidence = Pick<DomNodeEvidence['nodes'][number], 'size' | 'styles'>

export function readDomVisibility({ size, styles }: LayoutEvidence, label: string) {
  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 0 || size.height < 0) {
    throw new Error(`DOM evidence invalid layout: ${label}`)
  }
  if (!styles || ['display', 'visibility', 'opacity'].some(key => !Object.hasOwn(styles, key)
    || (styles[key] !== null && typeof styles[key] !== 'string'))) {
    throw new Error(`DOM evidence missing computed visibility: ${label}`)
  }
  const { display, visibility, opacity } = styles
  if ([display, visibility, opacity].some(value => typeof value === 'string' && value.trim().length === 0)
    || (opacity !== null && (!Number.isFinite(Number(opacity)) || Number(opacity) < 0 || Number(opacity) > 1))) {
    throw new Error(`DOM evidence invalid computed visibility: ${label}`)
  }
  // 未投影节点没有布局面积，真实 IDE 可同时返回 null 样式；保留观测，不把 null 转成默认 CSS。
  if (size.width === 0 || size.height === 0) {
    return false
  }
  if (display === null || visibility === null || opacity === null) {
    throw new Error(`DOM evidence missing computed visibility: ${label}`)
  }
  return display !== 'none' && visibility !== 'hidden' && visibility !== 'collapse' && Number(opacity) > 0
}
