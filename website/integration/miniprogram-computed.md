# miniprogram-computed 集成

和 `miniprogram-computed` 大部分和官方一样，只有一点不同，就是安装包的时候要多装 `2` 个包作为它的依赖

## 安装

```sh
pnpm i miniprogram-computed fast-deep-equal rfdc
```

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
