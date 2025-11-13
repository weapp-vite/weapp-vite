## 创建小程序

使用 `createApp` 来创建小程序实例，它接收小程序 `App` 构造函数中的所有参数，还能接收 `setup` 函数，就像 `vue@3` 那样

```ts
import { createApp } from 'wevu'

const app = createApp({
  setup() {
    return {}
  }
})
// 调用 mount 方法，才真正的调用 App 构造函数
app.mount()
```

## 定义页面

```ts
import { definePage } from 'wevu'

definePage({
  setup() {
    return {}
  }
}).mount()
```

## 定义组件

```ts
import { defineComponent } from 'wevu'

defineComponent({
  setup() {
    return {}
  }
}).mount()
```

## 提供的 API

```ts
import {
  computed,
  getCurrentInstance,
  reactive,
  ref,
  watch
} from 'wevu'
```
