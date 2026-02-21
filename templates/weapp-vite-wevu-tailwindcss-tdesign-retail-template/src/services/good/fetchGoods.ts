import { config } from '../../config/index'
import { getGoodsList } from '../../model/goods'
import { delay } from '../_utils/delay'

/** 获取商品列表 */
function mockFetchGoodsList(pageIndex = 1, pageSize = 20) {
  return delay().then(() => {
    const goodsList = getGoodsList(pageIndex, pageSize)
    const safeGoodsList = Array.isArray(goodsList) ? goodsList : []
    return safeGoodsList.map((item) => {
      const spuTagList = Array.isArray(item?.spuTagList) ? item.spuTagList : []
      return {
        spuId: item.spuId,
        thumb: item.primaryImage,
        title: item.title,
        price: item.minSalePrice,
        originPrice: item.maxLinePrice,
        tags: spuTagList.map(tag => tag?.title).filter(Boolean),
      }
    })
  })
}

/** 获取商品列表 */
export function fetchGoodsList(pageIndex = 1, pageSize = 20) {
  if (config.useMock) {
    return mockFetchGoodsList(pageIndex, pageSize)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
