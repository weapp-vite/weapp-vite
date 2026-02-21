# 90 秒录屏台本（VSCode 手打 + 智能提示）

这个台本对应两个场景文件：

- 起始态：`src/pages/index/index.recording-90s-starter.vue`
- 完成态：`src/pages/index/index.recording-90s-final.vue`

## 录制前准备（20 秒）

1. 执行：`pnpm -C apps/wevu-vue-sfc-recording-demo demo:reset:90s`
2. 执行：`pnpm -C apps/wevu-vue-sfc-recording-demo dev`
3. 在 VSCode 打开：`src/pages/index/index.vue`
4. 右侧保留微信开发者工具预览（或录制时保留一角）

## 90 秒时间轴

### 0s - 10s：开场与定位

- 光标放在第 2 行 `import { ref } from 'wevu'`
- 稍停 1 秒，让观众看到起始代码

### 10s - 30s：导入补全（智能提示第一波）

依次手打并触发补全：

- 输入 `, com` 然后 `Ctrl+Space`，选择 `computed`
- 输入 `, onS` 然后 `Ctrl+Space`，选择 `onShow`
- 输入 `, wat` 然后 `Ctrl+Space`，选择 `watch`

完成后导入应为：

```ts
import { computed, onShow, ref, watch } from 'wevu'
```

### 30s - 55s：逻辑补全（智能提示第二波）

在 `features` 下方手打：

```ts
const finishedCount = computed(() => features.value.filter(item => item.done).length)
const progressText = computed(() => `${finishedCount.value}/${features.value.length}`)
```

在 `toggle` 下方手打：

```ts
function reset() {
  clicks.value = 0
  features.value = features.value.map(item => ({
    ...item,
    done: item.name.includes('编译') || item.name.includes('宏'),
  }))
}

onShow(() => {
  console.log('[recording-demo-90s] page show')
})

watch(clicks, (newValue, oldValue) => {
  console.log(`[recording-demo-90s] clicks: ${oldValue} -> ${newValue}`)
})
```

### 55s - 75s：模板补全（绑定与事件）

做 3 个替换：

1. 把“任务数量”文案改为“完成进度”
2. 把 `{{ features.length }}` 改为 `{{ progressText }}`
3. 在 `+1` 按钮后新增 `重置` 按钮：

```vue
<button class="btn" @tap="reset">重置</button>
```

再给状态文本加动态 class：

```vue
<text class="feature-state" :class="item.done ? 'done' : 'todo'">
```

### 75s - 90s：保存与热更新

- 按 `Cmd+S`
- 展示预览区域同步更新
- 鼠标点击一次 `+1` 和一次 `重置`
- 结束录制

## 失败重录策略

- 一次重置：`pnpm -C apps/wevu-vue-sfc-recording-demo demo:reset:90s`
- 直接回完成态：`pnpm -C apps/wevu-vue-sfc-recording-demo demo:final:90s`

注意：这两个命令都会覆盖 `src/pages/index/index.vue`，只能顺序执行。
