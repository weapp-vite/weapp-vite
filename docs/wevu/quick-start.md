# 快速上手

前提条件

- 熟悉命令行
- Node.js（推荐 20+）
- 已安装 weapp-vite 工具链（见仓库根 README）

新建或接入

- 新建项目：使用本仓库模板或你已有的小程序工程，集成 weapp-vite 与 wevu。
- 接入 wevu：在逻辑层直接从 `wevu` 导入 API 使用（示例见下文），模板/样式/配置仍按小程序原生方式维护。

开发与构建

- 开发启动：`pnpm dev`（或以包为单位启动）
- 单次构建：`pnpm build` -导入微信开发者工具时请选择“项目根目录”而非 `dist`

示例骨架

```ts
// app.ts
import { createApp, onAppShow } from 'wevu'

createApp({
  setup() {
    onAppShow(() => console.log('app show'))
    return { version: '0.1.0' }
  }
})
```

```ts
// pages/home/index.ts
import { computed, defineComponent, onShow, reactive } from 'wevu'

defineComponent({
  setup() {
    const state = reactive({ count: 0, double: computed(() => state.count * 2) })
    function inc() {
      state.count++
    }
    onShow(() => console.log('page show'))
    return { state, inc }
  }
})
```

```ts
// components/counter/index.ts
import { computed, defineComponent } from 'wevu'

defineComponent({
  properties: { count: Number },
  setup(props) {
    const double = computed(() => props.count * 2)
    return { double }
  }
})
```

发布

- 构建：`pnpm build`
- 上传：使用微信开发者工具上传（忽略“未压缩”提示，构建已做定制压缩）
