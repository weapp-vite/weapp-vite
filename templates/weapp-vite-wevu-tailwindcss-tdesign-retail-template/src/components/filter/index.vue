<script setup lang="ts">
defineOptions({
  externalClasses: ['wr-class'],
  options: {
    multipleSlots: true
  },
  properties: {
    overall: {
      type: Number,
      value: 1,
      observer(overall) {
        this.setData({
          overall
        });
      }
    },
    layout: {
      type: Number,
      value: 1,
      observer(layout) {
        this.setData({
          layout
        });
      }
    },
    sorts: {
      type: String,
      value: '',
      observer(sorts) {
        this.setData({
          sorts
        });
      }
    },
    color: {
      type: String,
      value: '#FA550F'
    }
  },
  data() {
    return {
      layout: 1,
      overall: 1,
      sorts: ''
    };
  },
  methods: {
    onChangeShowAction() {
      const {
        layout
      } = this.data;
      const nextLayout = layout === 1 ? 0 : 1;
      this.triggerEvent('change', {
        ...this.properties,
        layout: nextLayout
      });
    },
    handlePriseSort() {
      const {
        sorts
      } = this.data;
      this.triggerEvent('change', {
        ...this.properties,
        overall: 0,
        sorts: sorts === 'desc' ? 'asc' : 'desc'
      });
    },
    open() {
      this.triggerEvent('showFilterPopup', {
        show: true
      });
    },
    onOverallAction() {
      const {
        overall
      } = this.data;
      const nextOverall = overall === 1 ? 0 : 1;
      const nextData = {
        sorts: '',
        prices: []
      };
      this.triggerEvent('change', {
        ...this.properties,
        ...nextData,
        overall: nextOverall
      });
    }
  }
});
</script>

<template>
<!-- 过滤组件 -->
<view class="wr-class filter-wrap [width:100%] [height:88rpx] [display:flex] [justify-content:space-between] [position:relative] [background:#fff]">
	<view class="filter-left-content [height:100%] [display:flex] [flex-grow:2] [flex-flow:row_nowrap] [justify-content:space-between] [&_.filter-item]:[flex:1] [&_.filter-item]:[height:100%] [&_.filter-item]:[display:flex] [&_.filter-item]:[align-items:center] [&_.filter-item]:[justify-content:center] [&_.filter-item]:[font-size:26rpx] [&_.filter-item]:[line-height:36rpx] [&_.filter-item]:[font-weight:400] [&_.filter-item]:[color:rgba(51,_51,_51,_1)] [&_.filter-item_.filter-price]:[display:flex] [&_.filter-item_.filter-price]:[flex-direction:column] [&_.filter-item_.filter-price]:[margin-left:6rpx] [&_.filter-item_.filter-price]:[justify-content:space-between] [&_.filter-item_.wr-filter]:[margin-left:8rpx] [&_.filter-active-item]:[color:#fa550f]">
		<view class="filter-item {{overall === 1 ? 'filter-active-item' : ''}}" bindtap="onOverallAction">
			综合
		</view>
		<view class="filter-item" bind:tap="handlePriseSort">
			<text style="color: {{ sorts != '' ? color : '' }}">价格</text>
			<view class="filter-price">
				<t-icon
				  prefix="wr"
				  name="arrow_drop_up"
				  size="18rpx"
				  style="color: {{ sorts == 'asc' ? color : '#bbb' }}"
				/>
				<t-icon
				  prefix="wr"
				  name="arrow_drop_down"
				  size="18rpx"
				  style="color: {{ sorts == 'desc' ? color : '#bbb' }}"
				/>
			</view>
		</view>
		<view class="filter-item {{prices.length ? 'filter-active-item' : ''}}" bindtap="open" data-index="5">
			筛选
			<t-icon
			  name="filter"
			  prefix="wr"
			  color="#333"
			  size="32rpx"
			/>
		</view>
	</view>
</view>
<!-- 筛选弹框 -->
<slot name="filterPopup" />

</template>

<json>
{
    "component": true,
    "usingComponents": {
        "t-icon": "tdesign-miniprogram/icon/icon"
    }
}</json>
