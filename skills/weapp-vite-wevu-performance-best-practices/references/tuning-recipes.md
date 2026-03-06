# Tuning Recipes

## 1) 一键开启常用运行时优化

```ts
// vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wevu: {
      preset: 'performance',
      // 也可以按页面灰度开启，避免一次性全局放大变更
      autoSetDataPick: true,
    },
  },
})
```

## 2) 避免滚动链路高频 setData

```ts
import { defineComponent, ref, useIntersectionObserver } from 'wevu'

defineComponent({
  setup() {
    const visible = ref(false)
    const observer = useIntersectionObserver({ thresholds: [0, 0.5, 1] })

    // 伪代码：按实际节点选择器调整
    observer.relativeToViewport().observe('.target', (res) => {
      visible.value = res.intersectionRatio > 0
    })

    return { visible }
  },
})
```

## 3) 后台态减少无效更新竞争

```ts
import { setWevuDefaults } from 'wevu'

setWevuDefaults({
  component: {
    setData: {
      strategy: 'patch',
      suspendWhenHidden: true,
      highFrequencyWarning: true,
    },
  },
})
```

## 4) 内存告警统一释放大对象

```ts
import { onMemoryWarning } from 'wevu'

onMemoryWarning(() => {
  // 释放缓存、注销监听、停止轮询
  // cache.clear()
  // offXXX()
  // clearInterval(timer)
})
```

## 5) 页面切换链路的最小观测

```ts
const perf = wx.getPerformance?.()
const obs = perf?.createObserver?.((entryList) => {
  for (const entry of entryList.getEntries()) {
    // 关注 route / firstRender 的 start-end 差值
    console.log(entry.entryType, entry.name, entry.startTime, entry.duration)
  }
})

obs?.observe?.({ entryTypes: ['navigation', 'render'] })
```

## 6) 图片策略

- 以展示尺寸供图，避免原图直传。
- 长列表避免大图密集出现。
- 谨慎使用 `widthFix/heightFix`，对背景图和 banner 优先显式宽高。
