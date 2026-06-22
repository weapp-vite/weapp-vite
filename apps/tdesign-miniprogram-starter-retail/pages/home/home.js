import Toast from 'tdesign-miniprogram/toast/index'
import { fetchGoodsList } from '../../services/good/fetchGoods'
import { fetchHome } from '../../services/home/home'

const MAX_HOME_GOODS_PAGE = 3

Page({
  data: {
    imgSrcs: [],
    tabList: [],
    goodsList: [],
    goodsListLoadStatus: 0,
    pageLoading: false,
    current: 1,
    autoplay: true,
    duration: '500',
    interval: 5000,
    navigation: { type: 'dots' },
    swiperImageProps: { mode: 'scaleToFill' },
  },

  goodListPagination: {
    pageIndex: 0,
    num: 20,
    loadedPageCount: 0,
  },

  privateData: {
    tabIndex: 0,
  },

  onShow() {
    this.getTabBar().init()
  },

  onLoad() {
    this.init()
  },

  onReachBottom() {
    if (
      this.data.goodsListLoadStatus === 0
      && this.goodListPagination.loadedPageCount < MAX_HOME_GOODS_PAGE
    ) {
      this.loadGoodsList()
    }
  },

  onPullDownRefresh() {
    this.init()
  },

  init() {
    this.loadHomePage()
  },

  loadHomePage() {
    wx.stopPullDownRefresh()

    this.setData({
      pageLoading: true,
    })
    fetchHome().then(({ swiper, tabList }) => {
      this.setData({
        tabList,
        imgSrcs: swiper,
        pageLoading: false,
      })
      this.loadGoodsList(true)
    })
  },

  tabChangeHandle(e) {
    this.privateData.tabIndex = e.detail
    this.loadGoodsList(true)
  },

  onReTry() {
    if (this.goodListPagination.loadedPageCount >= MAX_HOME_GOODS_PAGE) {
      this.setData({ goodsListLoadStatus: 2 })
      return
    }

    this.loadGoodsList()
  },

  async loadGoodsList(fresh = false) {
    if (fresh) {
      wx.pageScrollTo({
        scrollTop: 0,
      })
    }

    this.setData({ goodsListLoadStatus: 1 })

    const pageSize = this.goodListPagination.num
    let pageIndex = this.goodListPagination.pageIndex
    if (fresh) {
      pageIndex = 0
      this.goodListPagination.loadedPageCount = 0
    }
    const goodsBaseId = this.privateData.tabIndex * pageSize + pageIndex * pageSize

    try {
      const nextList = await fetchGoodsList(goodsBaseId, pageSize)
      const loadedPageCount = this.goodListPagination.loadedPageCount + 1
      this.setData({
        goodsList: fresh ? nextList : this.data.goodsList.concat(nextList),
        goodsListLoadStatus: loadedPageCount >= MAX_HOME_GOODS_PAGE ? 2 : 0,
      })

      this.goodListPagination.pageIndex = pageIndex + 1
      this.goodListPagination.num = pageSize
      this.goodListPagination.loadedPageCount = loadedPageCount
    }
    catch (err) {
      this.setData({ goodsListLoadStatus: 3 })
    }
  },

  goodListClickHandle(e) {
    const { index } = e.detail
    const { spuId } = this.data.goodsList[index]
    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${spuId}`,
    })
  },

  goodListAddCartHandle() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '点击加入购物车',
    })
  },

  navToSearchPage() {
    wx.navigateTo({ url: '/pages/goods/search/index' })
  },

  navToActivityDetail({ detail }) {
    const { index: promotionID = 0 } = detail || {}
    wx.navigateTo({
      url: `/pages/promotion/promotion-detail/index?promotion_id=${promotionID}`,
    })
  },
})
