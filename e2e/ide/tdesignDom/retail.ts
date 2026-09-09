import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { classText, xpathClass } from './index'

export const RETAIL_FIXTURE = 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template'
export const RETAIL_FIRST_TITLE = '白色短袖连衣裙荷叶边裙摆宽松韩版休闲纯白清爽优雅连衣裙'

export function retailHomeCheckpoint(id: string, action: string): DomCheckpoint {
  return {
    id,
    route: '/pages/home/home',
    action,
    nodes: [
      { selector: xpathClass('goods-card__title'), query: 'xpath', count: 4 },
      { selector: '//*[@id="home-goods-list-gd-0"]//*[contains(concat(" ", @class, " "), " goods-card__title ")]', query: 'xpath', text: RETAIL_FIRST_TITLE },
      { selector: xpathClass('t-tabs__item'), query: 'xpath', count: 7 },
      classText('t-tabs__item--active', '精选推荐'),
    ],
  }
}
