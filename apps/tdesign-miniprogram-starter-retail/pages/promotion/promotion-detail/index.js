import Toast from 'tdesign-miniprogram/toast/index';
import { fetchPromotion } from '../../../services/promotion/detail';

Page({
  data: {
    list: [],
    banner: '',
    time: 0,
    showBannerDesc: false,
    statusTag: '',
  },

  onLoad(query) {
    const promotionID = this.parsePromotionId(query?.promotion_id);
    this.getGoodsList(promotionID);
  },

  parsePromotionId(rawPromotionId) {
    const parsed = Number.parseInt(String(rawPromotionId ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  },

  getGoodsList(promotionID) {
    fetchPromotion(promotionID).then(({ list, banner, time, showBannerDesc, statusTag }) => {
      const safeList = Array.isArray(list) ? list : [];
      const goods = safeList.map((item) => {
        const rawTags = Array.isArray(item?.tags) ? item.tags : [];
        return {
          ...item,
          tags: rawTags.map((tag) => (typeof tag === 'string' ? tag : tag?.title)).filter(Boolean),
        };
      });
      this.setData({
        list: goods,
        banner,
        time,
        showBannerDesc,
        statusTag,
      });
    }).catch(() => {
      this.setData({
        list: [],
        banner: '',
        time: 0,
        showBannerDesc: false,
        statusTag: '',
      });
      Toast({
        context: this,
        selector: '#t-toast',
        message: '营销活动加载失败',
      });
    });
  },

  goodClickHandle(e) {
    const { index } = e.detail;
    const { spuId } = this.data.list[index];
    wx.navigateTo({ url: `/pages/goods/details/index?spuId=${spuId}` });
  },

  cardClickHandle() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '点击加购',
    });
  },

  bannerClickHandle() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '点击规则详情',
    });
  },
});
