# #1331 审查边界

输入来自 [PR #1333 的审查评论](https://github.com/weapp-vite/weapp-vite/pull/1333#issuecomment-6858433397)：

- `defineOptions({ options: { pureDataPattern: /^_/ } })` 与 `ref('ready')`。
- 普通 `<script>` 的 `setup() { return { label: computed(() => 'ready') } }`。
- 原生组件 `pureDataPattern` 对逻辑数据、视图和属性/data observer 的契约。

两个 Host 保留评论中的最小输入，原生 StatusLabel 记录 created、首次属性 observer、attached、ready。页面只提供启动与证据读取入口；作者原始 fixture 独立保留。原生 created 阶段可能仍读取属性默认值，断言以真实宿主的首次交付和后续生命周期为准。纯数据字段的真实视图过滤由 simulator 的 Node、browser session 和 Chromium 覆盖。
