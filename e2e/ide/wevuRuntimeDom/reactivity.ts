import type { DomCheckpoint } from '../../utils/domAcceptance/types'

export const CLASS_COMPUTED_CHECKPOINTS: DomCheckpoint[] = [
  {
    id: 'initial',
    route: '/pages/class-computed/index',
    action: '检查 computed 初始分支及两行折叠状态',
    nodes: [
      { selector: '#computed-class-target.class-b', text: 'computed-class-target' },
      { selector: '#computed-class-target.class-a', count: 0 },
      { selector: '#nested-ternary-list .item.collapsed.bg-white', count: 2 },
      { selector: '#nested-ternary-list .item.expanded', count: 0 },
    ],
  },
  {
    id: 'updated',
    route: '/pages/class-computed/index',
    action: '更新 ref/computed 并检查选中行的真实 class 分支',
    nodes: [
      { selector: '#computed-class-target.class-a', text: 'computed-class-target' },
      { selector: '#computed-class-target.class-b', count: 0 },
      { selector: '#nested-ternary-list .item.expanded', count: 2 },
      { selector: '#nested-ternary-list .item.expanded.bg-white', text: 'row-0' },
      { selector: '#nested-ternary-list .item.expanded.bg-theme-dark', text: 'row-1' },
      { selector: '#nested-ternary-list .item.collapsed', count: 0 },
    ],
  },
]

function quantityCheckpoint(id: string, quantity: number, action: string): DomCheckpoint {
  return {
    id,
    route: '/pages/wevu-inline-object-reactivity-repro/index',
    action,
    nodes: [
      { selector: '#qty-0', text: String(quantity) },
      { selector: '#minus-0', text: '-' },
      { selector: '#plus-0', text: '+' },
    ],
  }
}

export const INLINE_OBJECT_BOUND_CHECKPOINTS = [
  quantityCheckpoint('initial', 2, '检查初始数量和加减控件'),
  quantityCheckpoint('minus', 1, '减一次后显示下界数量'),
  quantityCheckpoint('minimum', 1, '再次减少后仍保持下界'),
  quantityCheckpoint('plus', 2, '增加一次后界面同步'),
  quantityCheckpoint('plus-again', 3, '连续增加后界面同步'),
  quantityCheckpoint('restored', 2, '减少后恢复初始数量'),
]

export const INLINE_OBJECT_REPEATED_CHECKPOINTS = [
  quantityCheckpoint('initial', 2, '检查初始数量和加减控件'),
  quantityCheckpoint('increased', 7, '连续增加五次后显示七'),
  quantityCheckpoint('minimum', 1, '连续减少十二次后保持下界'),
  quantityCheckpoint('increased-again', 4, '从下界连续增加三次后显示四'),
]
