# 120 秒录屏台本（更像真实开发）

这个版本用于在 PPT 中展示“真实开发现场”：有补全、有一次小失误、有保存和热更新。

对应场景文件：

- 起始态：`src/pages/index/index.recording-120s-starter.vue`
- 完成态：`src/pages/index/index.recording-120s-final.vue`

## 开始前（15 秒）

1. 执行：`pnpm -C apps/wevu-vue-sfc-recording-demo demo:reset:120s`
2. 执行：`pnpm -C apps/wevu-vue-sfc-recording-demo dev`
3. 打开：`src/pages/index/index.vue`
4. 光标定位到 `import { ref } from 'wevu'`

## 时间轴脚本

### 0s - 25s：导入补全

输入并选择提示：

- `, com` + `Ctrl+Space` -> `computed`
- `, onS` + `Ctrl+Space` -> `onShow`
- `, wat` + `Ctrl+Space` -> `watch`

目标导入：

```ts
import { computed, onShow, ref, watch } from 'wevu'
```

### 25s - 55s：先写计算属性

在 `features` 下方加入：

```ts
const finishedCount = computed(() => features.value.filter(item => item.done).length)
const progressText = computed(() => `${finishedCount.value}/${features.value.length}`)

const filteredFeatures = computed(() => {
  if (!keyword.value.trim())
    return features.value

  return features.value.filter(item => item.name.includes(keyword.value.trim()))
})
```

### 55s - 80s：故意小失误并修正（真实感）

1. 在模板里把 `features` 改成 `filteredFeatures`（`v-for` 那行）。
2. 在 `toggle` 里先故意写：

```ts
const target = features.value[index]
```

3. 停半秒，马上改成：

```ts
const target = filteredFeatures.value[index]
```

这段会让观众觉得是现场编码，不是背稿复制。

### 80s - 105s：补全事件与按钮

1. `input` 增加 `@input`：

```vue
@input="keyword = $event.detail.value"
```

2. 新增 `reset()`：

```ts
function reset() {
  clicks.value = 0
  keyword.value = ''
  features.value = features.value.map(item => ({
    ...item,
    done: item.name.includes('编译') || item.name.includes('宏'),
  }))
}
```

3. 操作区新增按钮：

```vue
<button class="btn" @tap="reset">重置</button>
```

### 105s - 120s：保存与效果确认

1. 按 `Cmd+S`
2. 观察预览热更新
3. 输入框输入“智能”
4. 点一次列表项切换状态
5. 点 `重置` 收尾

## 结束后复位

- 恢复默认完成态：`pnpm -C apps/wevu-vue-sfc-recording-demo demo:final`
- 如果要重录 120 秒：`pnpm -C apps/wevu-vue-sfc-recording-demo demo:reset:120s`
