# Web Runtime Compatibility

- Web runtime 用来验证跨平台渲染和 Web API 适配，不等价于微信 DevTools 或真机。
- 默认 `runtime.viewport.mode` 为 `mini-program`：移动宽度下铺满，600px 以上使用 375px 居中容器；旧全宽行为显式使用 `responsive`。
- `rpx` 按设备容器宽度计算。排查桌面端比例问题时先检查 `#app` 实际宽度和 `--rpx`，不要直接用 `window.innerWidth` 推断。
- `view`、`text`、`image`、`button`、`input`、`scroll-view` 会编译成 `weapp-*` 运行时标签；编写浏览器断言时不要继续假设它们是 `div`、`span`、`img` 或原生 `input`。
- WXSS 的 `page` 映射到页面 Shadow DOM 的 `:host`，原生组件类型选择器同步映射到 `weapp-*`；class、attribute、pseudo 与组合结构应保持稳定。
- 微信 DevTools 视觉基线只通过 `pnpm e2e:web:update-baselines` 显式更新。普通 `pnpm e2e:web` 只消费 manifest 与已提交 PNG，并把 current/diff 写入 `.tmp/web-runtime-visual/`。
- URL、URLSearchParams、fetch/request globals 需要在目标 runtime 做最小验证；浏览器通过不代表宿主通过。
- 第三方请求客户端若只在 DevTools 失败，先缩小到宿主构造器兼容问题，再决定 skip、polyfill 或业务修复。
