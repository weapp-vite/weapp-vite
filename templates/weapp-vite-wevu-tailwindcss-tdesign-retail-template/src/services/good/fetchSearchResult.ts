// @ts-nocheck
import { config } from '../../config/index'
import { getSearchResult as getSearchResultModel } from '../../model/search'
import { delay } from '../_utils/delay'

type SearchResultSpuItem = ReturnType<typeof getSearchResultModel>['spuList'][number]
interface SearchResultTag {
  title: string
}
type SearchResultListItem = SearchResultSpuItem & {
  thumb: string
  price: string | number
  originPrice: string | number
  tags: SearchResultTag[]
}

/** 获取搜索历史 */
function mockSearchResult(params) {
  const data = getSearchResultModel(params)
  const spuList: SearchResultListItem[] = data.spuList.map((item: SearchResultSpuItem) => ({
    ...item,
    thumb: item.primaryImage,
    price: item.minSalePrice,
    originPrice: item.maxLinePrice,
    tags: item.spuTagList?.map(tag => ({ title: tag.title })) ?? [],
  }))
  return delay().then(() => {
    return {
      ...data,
      spuList,
    }
  })
}

/** 获取搜索历史 */
export function getSearchResult(params) {
  if (config.useMock) {
    return mockSearchResult(params)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
