<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantAreaPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-area',
}))

const areaList = ref({ province_list: { 110000: '北京' }, city_list: { 110100: '北京市' }, county_list: { 110101: '东城区', 110102: '西城区' } })
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-area
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-area :area-list="areaList" />
      </view>
    </view>
  </van-config-provider>
</template>
