# miniprogram-computed 集成

`miniprogram-computed` 的用法基本和官方一致。需要注意的是：为了确保构建产物里依赖齐全，建议把它的运行时依赖也显式安装到项目里（避免构建时被裁剪/遗漏）。

## 安装

```sh
pnpm add miniprogram-computed fast-deep-equal rfdc
```

> [!TIP]
> `miniprogram-computed` 是运行时要用的库，更推荐放在 `dependencies` 而不是 `devDependencies`。

## 使用方式

```ts
import { ComponentWithComputed } from 'miniprogram-computed'
// js 中也可以使用 import { behavior as computedBehavior } from 'miniprogram-computed'
ComponentWithComputed({
  data: {
    a: 1,
    b: 1,
  },
  computed: {
    sum(data) {
      // 注意： computed 函数中不能访问 this ，只有 data 对象可供访问
      // 这个函数的返回值会被设置到 this.data.sum 字段中
      return data.a + data.b
    },
  },
  methods: {
    onTap() {
      this.setData({
        a: this.data.b,
        b: this.data.a + this.data.b,
      })
    },
  },
})
```

相关 `issues`:

1. [miniprogram-computed](https://github.com/weapp-vite/weapp-vite/issues/65)
2. [fast-deep-equal和rfdc可以放在peer-dependencies里面吗？](https://github.com/wechat-miniprogram/computed/issues/87)
