# Wevu Tuning Recipes

## weapp-vite 编译优化（可选）

仅当消费项目已显式安装 `weapp-vite` 时使用此配置；`preset` 与 `autoSetDataPick` 属于构建器配置，不是 `wevu` 包自身的必需入口。只安装 `wevu` 时使用下方 `setWevuDefaults()` 配置运行时。

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
import { defineComponent, ref, useElementIntersectionObserver } from 'wevu'

defineComponent({
  setup() {
    const visible = ref(false)
    useElementIntersectionObserver({
      selector: '.target',
      observerOptions: { thresholds: [0, 0.5, 1] },
      onObserve(res: any) {
        visible.value = res.intersectionRatio > 0
      },
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

在应用创建页面/组件前设置默认值；单个实例也可在 `defineComponent({ setData: { ... }, setup() { ... } })` 中配置。先记录相同输入的调用量、payload 和真实视图结果，再比较策略；隐藏时暂停不等于页面卸载，返回前台后需核对最终状态。
