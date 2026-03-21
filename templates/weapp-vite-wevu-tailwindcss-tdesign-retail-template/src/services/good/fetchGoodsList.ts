// @ts-nocheck
import { config } from '../../config/index'
import { getSearchResult } from '../../model/search'
import { delay } from '../_utils/delay'

type SearchResultSpuItem = ReturnType<typeof getSearchResult>['spuList'][number]
type GoodsListSpuItem = SearchResultSpuItem & {
  thumb: string
  price: string | number
  originPrice: string | number
  desc: string[]
  tags: string[]
}

/** 获取商品列表 */
function mockFetchGoodsList(params) {
  const data = getSearchResult(params)
  const spuList: GoodsListSpuItem[] = data.spuList.map((item: SearchResultSpuItem) => ({
    ...item,
    thumb: item.primaryImage,
    price: item.minSalePrice,
    originPrice: item.maxLinePrice,
    desc: [],
    tags: item.spuTagList?.map(tag => tag.title) ?? [],
  }))
  return delay().then(() => {
    return {
      ...data,
      spuList,
    }
  })
}

/** 获取商品列表 */
export function fetchGoodsList(params) {
  if (config.useMock) {
    return mockFetchGoodsList(params)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
