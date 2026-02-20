<script lang="ts">
import dayjs from 'dayjs';
import { couponsData } from './mock';

const emptyCouponImg = `https://tdesign.gtimg.com/miniprogram/template/retail/coupon/ordersure-coupon-newempty.png`;

Component({
  properties: {
    storeId: String,
    promotionGoodsList: {
      type: Array,
      value: [],
    },
    orderSureCouponList: {
      type: Array,
      value: [],
    },
    couponsShow: {
      type: Boolean,
      value: false,
      observer(couponsShow) {
        if (couponsShow) {
          const { promotionGoodsList, orderSureCouponList, storeId } = this.data;
          const products =
            promotionGoodsList &&
            promotionGoodsList.map((goods) => {
              this.storeId = goods.storeId;
              return {
                skuId: goods.skuId,
                spuId: goods.spuId,
                storeId: goods.storeId,
                selected: true,
                quantity: goods.num,
                prices: {
                  sale: goods.settlePrice,
                },
              };
            });
          const selectedCoupons =
            orderSureCouponList &&
            orderSureCouponList.map((ele) => {
              return {
                promotionId: ele.promotionId,
                storeId: ele.storeId,
                couponId: ele.couponId,
              };
            });
          this.setData({
            products,
          });
          this.coupons({
            products,
            selectedCoupons,
            storeId,
          }).then((res) => {
            this.initData(res);
          });
        }
      },
    },
  },
  data: {
    emptyCouponImg,
    goodsList: [],
    selectedList: [],
    couponsList: [],
    orderSureCouponList: [],
    promotionGoodsList: [],
  },
  methods: {
    initData(data = {}) {
      const { couponResultList = [], reduce = 0 } = data;
      const selectedList = [];
      let selectedNum = 0;
      const couponsList =
        couponResultList &&
        couponResultList.map((coupon) => {
          const { status, couponVO } = coupon;
          const { couponId, condition = '', endTime = 0, name = '', startTime = 0, value, type } = couponVO;
          if (status === 1) {
            selectedNum++;
            selectedList.push({
              couponId,
              promotionId: ruleId,
              storeId: this.storeId,
            });
          }
          const val = type === 2 ? value / 100 : value / 10;
          return {
            key: couponId,
            title: name,
            isSelected: false,
            timeLimit: `${dayjs(+startTime).format('YYYY-MM-DD')}-${dayjs(+endTime).format('YYYY-MM-DD')}`,
            value: val,
            status: status === -1 ? 'useless' : 'default',
            desc: condition,
            type,
            tag: '',
          };
        });
      this.setData({
        selectedList,
        couponsList,
        reduce,
        selectedNum,
      });
    },
    selectCoupon(e) {
      const { key } = e.currentTarget.dataset;
      const { couponsList, selectedList } = this.data;
      couponsList.forEach((coupon) => {
        if (coupon.key === key) {
          coupon.isSelected = !coupon.isSelected;
        }
      });

      const couponSelected = couponsList.filter((coupon) => coupon.isSelected === true);

      this.setData({
        selectedList: [...selectedList, ...couponSelected],
        couponsList: [...couponsList],
      });

      this.triggerEvent('sure', {
        selectedList: [...selectedList, ...couponSelected],
      });
    },
    hide() {
      this.setData({
        couponsShow: false,
      });
    },
    coupons(coupon = {}) {
      return new Promise((resolve, reject) => {
        if (coupon?.selectedCoupons) {
          resolve({
            couponResultList: couponsData.couponResultList,
            reduce: couponsData.reduce,
          });
        }
        return reject({
          couponResultList: [],
          reduce: undefined,
        });
      });
    },
  },
});
</script>

<template>
<wxs src="./selectCoupon.wxs" module="m1" />

<t-popup visible="{{couponsShow}}" placement="bottom" bind:visible-change="hide">
	<view class="select-coupons [background:#fff] [width:100%] [position:relative] [border-radius:20rpx_20rpx_0_0] [padding-top:28rpx] [padding-bottom:env(safe-area-inset-bottom)] [&_.title]:[width:100%] [&_.title]:[text-align:center] [&_.title]:[font-size:32rpx] [&_.title]:[color:#333] [&_.title]:[font-weight:600] [&_.title]:[line-height:44rpx] [&_.info]:[width:100%] [&_.info]:[height:34rpx] [&_.info]:[font-size:24rpx] [&_.info]:[color:#999] [&_.info]:[line-height:34rpx] [&_.info]:[margin:20rpx_0] [&_.info]:[padding:0_20rpx] [&_.info_.price]:[color:#fa4126] [&_.coupons-list]:[max-height:500rpx] [&_.coupons-list_.coupons-wrap]:[padding:0rpx_20rpx] [&_.coupons-list_.disable]:[font-size:24rpx] [&_.coupons-list_.disable]:[color:#ff2525] [&_.coupons-list_.disable]:[padding-top:20rpx] [&_.coupons-list_.slot-radio]:[position:absolute] [&_.coupons-list_.slot-radio]:[right:22rpx] [&_.coupons-list_.slot-radio]:[top:50%] [&_.coupons-list_.slot-radio]:[transform:translateY(-50%)] [&_.coupons-list_.slot-radio]:[display:inline-block] [&_.coupons-list_.slot-radio_.wr-check-filled]:[font-size:36rpx] [&_.coupons-list_.slot-radio_.check]:[width:36rpx] [&_.coupons-list_.slot-radio_.text-primary]:[color:#fa4126] [&_.coupons-list_.slot-radio_.wr-check]:[font-size:36rpx] [&_.coupons-list_.slot-radio_.wr-uncheck]:[font-size:36rpx] [&_.coupons-list_.slot-radio_.wr-uncheck]:[color:#999] [&_.couponp-empty-wrap]:[padding:40rpx] [&_.couponp-empty-wrap_.couponp-empty-img]:[display:block] [&_.couponp-empty-wrap_.couponp-empty-img]:[width:240rpx] [&_.couponp-empty-wrap_.couponp-empty-img]:[height:240rpx] [&_.couponp-empty-wrap_.couponp-empty-img]:[margin:0_auto] [&_.couponp-empty-wrap_.couponp-empty-title]:[font-size:28rpx] [&_.couponp-empty-wrap_.couponp-empty-title]:[color:#999] [&_.couponp-empty-wrap_.couponp-empty-title]:[text-align:center] [&_.couponp-empty-wrap_.couponp-empty-title]:[line-height:40rpx] [&_.couponp-empty-wrap_.couponp-empty-title]:[margin-top:40rpx] [&_.coupons-cover]:[height:112rpx] [&_.coupons-cover]:[width:100%] [&_.coupons-cover]:[box-sizing:border-box] [&_.coupons-cover]:[margin-top:30rpx] [&_.coupons-cover]:[padding:12rpx_32rpx] [&_.coupons-cover]:[display:flex] [&_.coupons-cover]:[justify-content:space-between] [&_.coupons-cover]:[align-items:center] [&_.coupons-cover_.btn]:[width:332rpx] [&_.coupons-cover_.btn]:[height:88rpx] [&_.coupons-cover_.btn]:[text-align:center] [&_.coupons-cover_.btn]:[line-height:88rpx] [&_.coupons-cover_.btn]:[font-size:32rpx] [&_.coupons-cover_.btn]:[border-radius:44rpx] [&_.coupons-cover_.btn]:[box-sizing:border-box] [&_.coupons-cover_.btn]:[border:2rpx_solid_#dddddd] [&_.coupons-cover_.btn]:[color:#333333] [&_.coupons-cover_.red]:[border-color:#fa4126] [&_.coupons-cover_.red]:[background-color:#fa4126] [&_.coupons-cover_.red]:[color:#ffffff]">
		<view class="title">选择优惠券</view>
		<block wx:if="{{couponsList && couponsList.length > 0}}">
			<view class="info">
				<block wx:if="{{!selectedNum}}">你有{{couponsList.length}}张可用优惠券</block>
				<block wx:else>
					已选中{{selectedNum}}张推荐优惠券, 共抵扣
					<wr-price fill="{{false}}" price="{{reduce || 0}}" />
				</block>
			</view>
			<scroll-view class="coupons-list" scroll-y="true">
				<view class="coupons-wrap">
					<block wx:for="{{couponsList}}" wx:key="index" wx:for-item="coupon">
						<coupon-card
						 title="{{coupon.title}}"
						 type="{{coupon.type}}"
						 status="{{coupon.status}}"
						 desc="{{coupon.desc}}"
						 value="{{coupon.value}}"
						 tag="{{coupon.tag}}"
						 timeLimit="{{coupon.timeLimit}}"
						>
							<view class="slot-radio" slot="operator">
                <t-icon bindtap="selectCoupon" data-key="{{coupon.key}}" name="{{coupon.isSelected ? 'check-circle-filled' : 'circle'}}" color="#fa4126" size="40rpx"/>
							</view>
						</coupon-card>
						<view class="disable" wx:if="{{coupon.status == 'useless'}}">此优惠券不能和已勾选的优惠券叠加使用</view>
					</block>
				</view>
			</scroll-view>
		</block>
		<view wx:else class="couponp-empty-wrap">
			<t-image t-class="couponp-empty-img" src="{{emptyCouponImg}}" />
			<view class="couponp-empty-title">暂无优惠券</view>
		</view>
		<view class="coupons-cover" />
	</view>
</t-popup>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-popup": "tdesign-miniprogram/popup/popup",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-image": "/components/webp-image/index",
    "wr-price": "/components/price/index",
    "coupon-card": "/components/promotion/ui-coupon-card/index"
  }
}
</json>
