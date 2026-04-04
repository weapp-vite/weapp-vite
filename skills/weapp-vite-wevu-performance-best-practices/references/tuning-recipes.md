# Tuning Recipes

## 开启常用运行时优化

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wevu: {
      preset: 'performance',
      autoSetDataPick: true,
    },
  },
})
```

## 避免滚动链路高频 setData

```ts
import { defineComponent, ref, useIntersectionObserver } from 'wevu'

defineComponent({
  setup() {
    const visible = ref(false)
    const observer = useIntersectionObserver({ thresholds: [0, 0.5, 1] })

    observer.relativeToViewport().observe('.target', (res) => {
      visible.value = res.intersectionRatio > 0
    })

    return { visible }
  },
})
```

## 后台态减少无效更新

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

## 内存告警时统一释放

```ts
import { onMemoryWarning } from 'wevu'

onMemoryWarning(() => {
  // cache.clear()
  // offXXX()
  // clearInterval(timer)
})
```

## 页面切换最小观测

```ts
const perf = wx.getPerformance?.()
const obs = perf?.createObserver?.((entryList) => {
  for (const entry of entryList.getEntries()) {
    console.log(entry.entryType, entry.name, entry.startTime, entry.duration)
  }
})

obs?.observe?.({ entryTypes: ['navigation', 'render'] })
```

## 图片策略

- 以展示尺寸供图
- 长列表避免大图密集出现
- 谨慎使用 `widthFix/heightFix`
