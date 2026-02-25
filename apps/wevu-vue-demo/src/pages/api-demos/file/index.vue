<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '文件能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
const fileName = 'wevu-demo.txt'

setStatus('待操作', 'ready')

function writeFile() {
  if (!hasWxApi('getFileSystemManager')) {
    setStatus('当前环境不支持文件系统', 'warning')
    return
  }
  const fsManager = wx.getFileSystemManager()
  if (!fsManager) {
    setStatus('文件系统不可用', 'warning')
    return
  }
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
  fsManager.writeFile({
    filePath,
    data: `wevu demo ${Date.now()}`,
    encoding: 'utf8',
    success: () => record('fs.writeFile', { filePath }),
    fail: err => recordError('fs.writeFile fail', err),
  })
}

function readFile() {
  if (!hasWxApi('getFileSystemManager')) {
    setStatus('当前环境不支持文件系统', 'warning')
    return
  }
  const fsManager = wx.getFileSystemManager()
  if (!fsManager) {
    setStatus('文件系统不可用', 'warning')
    return
  }
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
  fsManager.readFile({
    filePath,
    encoding: 'utf8',
    success: res => record('fs.readFile', res),
    fail: err => recordError('fs.readFile fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        文件能力
      </text>
      <text class="subtitle">
        读写用户数据目录文件。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          写入文件
        </text>
        <text class="card-desc">
          fs.writeFile 写入测试文件。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="writeFile">
            写入
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          读取文件
        </text>
        <text class="card-desc">
          fs.readFile 读取测试文件。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="readFile">
            读取
          </button>
        </view>
        <text class="hint">
          需先写入文件。
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
