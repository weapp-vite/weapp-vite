# Wevu Tuning Recipes

## 开启常用优化

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

## 收敛滚动链路更新

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
