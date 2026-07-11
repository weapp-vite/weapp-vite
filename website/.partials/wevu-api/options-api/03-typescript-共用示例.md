## TypeScript 共用示例 {#options-api-examples}

`props`、`data`、`computed`、`methods` 与宿主选项可以放在同一个定义中；注释标出了两套语义的边界。

```ts
import { defineComponent } from 'wevu'

export default defineComponent({
  props: { initial: { type: Number, default: 0 } },
  data() {
    return { count: this.initial }
  },
  computed: {
    doubled() { return this.count * 2 },
  },
  methods: {
    increment() { this.count += 1 },
  },
  // 以下字段直接交给小程序 Component()，不是 Vue Web 选项。
  options: { multipleSlots: true },
  lifetimes: {
    detached() { /* 清理宿主资源 */ },
  },
})
```
