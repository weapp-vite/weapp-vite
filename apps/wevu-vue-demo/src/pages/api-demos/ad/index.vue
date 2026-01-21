<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '广告能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
const adUnitId = 'adunit-xxxxxxxxxxxxxxxx'

setStatus('待操作', 'ready')

function showRewardedVideo() {
  if (!hasWxApi('createRewardedVideoAd')) {
    setStatus('当前环境不支持 createRewardedVideoAd', 'warning')
    return
  }
  setStatus('需要配置广告位 ID', 'warning')
  const ad = wx.createRewardedVideoAd({ adUnitId })
  ad.onError(err => recordError('RewardedVideoAd error', err))
  ad.load()
    .then(() => ad.show())
    .then(() => record('RewardedVideoAd.show', { ok: true }))
    .catch(err => recordError('RewardedVideoAd show fail', err))
}

function showInterstitial() {
  if (!hasWxApi('createInterstitialAd')) {
    setStatus('当前环境不支持 createInterstitialAd', 'warning')
    return
  }
  setStatus('需要配置广告位 ID', 'warning')
  const ad = wx.createInterstitialAd({ adUnitId })
  ad.onError(err => recordError('InterstitialAd error', err))
  ad.load()
    .then(() => ad.show())
    .then(() => record('InterstitialAd.show', { ok: true }))
    .catch(err => recordError('InterstitialAd show fail', err))
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        广告能力
      </text>
      <text class="subtitle">
        需配置广告位 ID。
      </text>
      <view class="status {{ statusTone }}">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          激励视频
        </text>
        <text class="card-desc">
          wx.createRewardedVideoAd。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="showRewardedVideo">
            展示
          </button>
        </view>
        <text class="hint">
          请替换为真实 adUnitId。
        </text>
      </view>

      <view class="card">
        <text class="card-title">
          插屏广告
        </text>
        <text class="card-desc">
          wx.createInterstitialAd。
        </text>
        <view class="card-actions">
          <button class="btn secondary" bindtap="showInterstitial">
            展示
          </button>
        </view>
        <text class="hint">
          基础库需支持插屏广告。
        </text>
      </view>
    </view>

    <view class="log">
      <text class="log-title">
        日志
      </text>
      <text class="log-body">
        {{ logText }}
      </text>
    </view>
  </view>
</template>

<style>
@import '../shared/page.css';
</style>
