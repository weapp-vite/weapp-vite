import type { DomCheckpoint } from '../../utils/domAcceptance/types'

export const complexADom: DomCheckpoint[] = [
  {
    id: 'main',
    route: '/pages/index/index',
    action: 'Render main-package direct and transitive imports',
    nodes: [{ selector: '#complex-a-main', text: '__SP_COMPLEX_A_CORE__|__SP_COMPLEX_A_TRANSITIVE__:__SP_COMPLEX_A_CORE__' }],
  },
  {
    id: 'item',
    route: '/subpackages/item/index',
    action: 'Render item-package shared chain and package-only npm imports',
    nodes: [{ selector: '#complex-a-item', text: '__SP_COMPLEX_A_CORE__|__SP_COMPLEX_A_SUB_ONLY__:__SP_COMPLEX_A_NPM_SUB_ONLY__|__SP_COMPLEX_A_CHAIN__:__SP_COMPLEX_A_SUB_ONLY__:__SP_COMPLEX_A_NPM_SUB_ONLY__:__SP_COMPLEX_A_PAIR_ONLY__|__SP_COMPLEX_A_NPM_SINGLE__' }],
  },
  {
    id: 'user',
    route: '/subpackages/user/index',
    action: 'Render user-package shared imports and the completed asynchronous import',
    nodes: [
      { selector: '#complex-a-user-sync', text: '__SP_COMPLEX_A_CORE__|__SP_COMPLEX_A_SUB_ONLY__:__SP_COMPLEX_A_NPM_SUB_ONLY__|__SP_COMPLEX_A_PAIR_ONLY__' },
      { selector: '#complex-a-user-async', text: '__SP_COMPLEX_A_ASYNC__' },
    ],
  },
  {
    id: 'report',
    route: '/subpackages/report/index',
    action: 'Render report-package imports after visiting the other subpackages',
    nodes: [{ selector: '#complex-a-report', text: '__SP_COMPLEX_A_CORE__|__SP_COMPLEX_A_SUB_ONLY__:__SP_COMPLEX_A_NPM_SUB_ONLY__' }],
  },
]

export const complexBDom: DomCheckpoint[] = [
  {
    id: 'home',
    route: '/pages/home/index',
    action: 'Render main-package base and math imports',
    nodes: [{ selector: '#complex-b-home', text: '__SP_COMPLEX_B_BASE__|__SP_COMPLEX_B_MATH__:__SP_COMPLEX_B_BASE__' }],
  },
  {
    id: 'alpha',
    route: '/subpackages/alpha/index',
    action: 'Render re-exported runtime-chain and edge imports',
    nodes: [{ selector: '#complex-b-alpha', text: '__SP_COMPLEX_B_RUNTIME_CHAIN__:__SP_COMPLEX_B_BASE__:__SP_COMPLEX_B_CLUSTER__:__SP_COMPLEX_B_NPM_SUB_ONLY__:__SP_COMPLEX_B_MATH__:__SP_COMPLEX_B_BASE__|__SP_COMPLEX_B_EDGE__' }],
  },
  {
    id: 'beta',
    route: '/subpackages/beta/index',
    action: 'Render beta-package shared and package-only npm imports',
    nodes: [{ selector: '#complex-b-beta', text: '__SP_COMPLEX_B_CLUSTER__:__SP_COMPLEX_B_NPM_SUB_ONLY__|__SP_COMPLEX_B_NPM_SINGLE__' }],
  },
  {
    id: 'gamma',
    route: '/subpackages/gamma/index',
    action: 'Render gamma-package shared imports and the completed lazy import',
    nodes: [
      { selector: '#complex-b-gamma-sync', text: '__SP_COMPLEX_B_RUNTIME_CHAIN__:__SP_COMPLEX_B_BASE__:__SP_COMPLEX_B_CLUSTER__:__SP_COMPLEX_B_NPM_SUB_ONLY__:__SP_COMPLEX_B_MATH__:__SP_COMPLEX_B_BASE__|__SP_COMPLEX_B_EDGE__' },
      { selector: '#complex-b-gamma-lazy', text: '__SP_COMPLEX_B_LAZY__' },
    ],
  },
]
