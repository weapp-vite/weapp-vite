<script lang="ts">
import { ref } from 'wevu'

interface PackageInfo {
  title: string
  desc: string
  root: string
  home: string
  detail: string
  independent: boolean
}

function loadSubPackage(root: string) {
  return new Promise<void>((resolve, reject) => {
    wx.loadSubPackage({
      name: root,
      success: () => resolve(),
      fail: error => reject(error),
    })
  })
}

export default {
  setup() {
    const loadingRoot = ref<string | null>(null)
    const loadResult = ref('')

    const packages: PackageInfo[] = [
      {
        title: '普通分包 A',
        desc: '可与主包/其他普通分包共享 store 与模块',
        root: 'subpackages/normal-a',
        home: '/subpackages/normal-a/pages/home/index',
        detail: '/subpackages/normal-a/pages/detail/index',
        independent: false,
      },
      {
        title: '普通分包 B',
        desc: '与普通分包 A 共享同一个 counter store',
        root: 'subpackages/normal-b',
        home: '/subpackages/normal-b/pages/home/index',
        detail: '/subpackages/normal-b/pages/detail/index',
        independent: false,
      },
      {
        title: '独立分包 A',
        desc: '独立运行环境（示例使用本分包内局部状态）',
        root: 'subpackages/independent-a',
        home: '/subpackages/independent-a/pages/home/index',
        detail: '/subpackages/independent-a/pages/detail/index',
        independent: true,
      },
      {
        title: '独立分包 B',
        desc: '第二个独立分包，便于对比与联调',
        root: 'subpackages/independent-b',
        home: '/subpackages/independent-b/pages/home/index',
        detail: '/subpackages/independent-b/pages/detail/index',
        independent: true,
      },
    ]

    async function onLoadPackage(root: string) {
      loadingRoot.value = root
      loadResult.value = `loading: ${root}`
      try {
        await loadSubPackage(root)
        loadResult.value = `loaded: ${root}`
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? 'unknown error')
        loadResult.value = `failed: ${root} (${message})`
      }
      finally {
        loadingRoot.value = null
      }
    }

    function navigateTo(url: string) {
      wx.navigateTo({ url })
    }

    return {
      packages,
      loadingRoot,
      loadResult,
      onLoadPackage,
      navigateTo,
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      分包场景（普通 / 独立）
    </view>
    <view class="section">
      <view class="section-title">
        说明
      </view>
      <view class="tip">
        <text>本页演示多个普通分包与多个独立分包的配置与跳转；普通分包 A/B 复用同一 counter store（可来回切换观察同步）。</text>
      </view>
      <view v-if="loadResult" class="tip-inline">
        <text>{{ loadResult }}</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        分包列表
      </view>
      <view v-for="item in packages" :key="item.root" class="pkg-card">
        <view class="pkg-title-row">
          <text class="pkg-title">
            {{ item.title }}
          </text>
          <text class="pkg-tag" :class="item.independent ? 'tag-independent' : 'tag-normal'">
            {{ item.independent ? '独立分包' : '普通分包' }}
          </text>
        </view>
        <view class="pkg-desc">
          {{ item.desc }}
        </view>
        <view class="pkg-root">
          root: {{ item.root }}
        </view>
        <view class="pkg-actions">
          <button
            class="btn btn-small btn-secondary"
            :disabled="loadingRoot === item.root"
            @click="onLoadPackage(item.root)"
          >
            {{ loadingRoot === item.root ? 'Loading...' : 'loadSubPackage' }}
          </button>
          <button class="btn btn-small btn-primary" @click="navigateTo(item.home)">
            Home
          </button>
          <button class="btn btn-small" @click="navigateTo(item.detail)">
            Detail
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.page-title {
  font-size: 44rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 24rpx;
}

.tip {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}

.tip-inline {
  margin-top: 16rpx;
  padding: 16rpx;
  border-radius: 12rpx;
  background: #f7f7ff;
  color: #4b4b7a;
  font-size: 24rpx;
}

.pkg-card {
  padding: 24rpx;
  border-radius: 16rpx;
  border: 2rpx solid #eef1f6;
  margin-bottom: 16rpx;
}

.pkg-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.pkg-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.pkg-tag {
  font-size: 22rpx;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
}

.tag-normal {
  color: #3b5bcc;
  background: #eef2ff;
}

.tag-independent {
  color: #b42318;
  background: #ffefea;
}

.pkg-desc {
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
  margin-bottom: 8rpx;
}

.pkg-root {
  font-size: 22rpx;
  color: #8a8a8a;
  margin-bottom: 12rpx;
}

.pkg-actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.btn-small {
  padding: 16rpx 20rpx;
  font-size: 24rpx;
}

.btn-secondary {
  background: #f1f5f9;
  color: #0f172a;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "分包场景"
}
</json>
