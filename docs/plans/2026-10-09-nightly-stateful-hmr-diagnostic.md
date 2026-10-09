# Nightly stateful HMR 验证与诊断

## 验收边界

用户明确选择 Nightly，本轮选中并实际连接微信开发者工具 `2.02.2610082`。官方 Stable 对照为 `2.02.2608080`，不能将本轮结果记为 Stable 通过。官方来源为 `https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json`；每个真实 IDE 入口均重新查询并将 UTC 查询时间保存在运行日志和版本报告中。

本轮排除 `uview-plus-compat,wot-ui-compat`，只验证 8 项 `ide-gate` 和 23 项 `ide-full` 核心回归。显式 CLI、渠道和精确版本选择保持一致，不修改登录、宿主归属、窗口预算或正式验收策略。

提交 `303cc74` 的完整 gate 已通过 8/8 task、27/27 case、162/162 checkpoint。随后完整 full 前 15 项通过，第 16 项 `ide/stateful-hmr.runtime.test.ts` 为 14/16 case、78/88 checkpoint；两个 Wevu 模板更新用例失败，后续 7 项尚未执行。完整 full 尚未通过，Goal 未完成。

gate 实际基础库覆盖 `3.17.2`、`3.17.3`、`3.17.4`；stateful HMR 使用 fixture 原有的 `3.16.3`。未为获得通过而切换基础库。

## 首错与最小对照

失败用例为：

- `rehydrates wevu local and store refs while preserving the native page instance`：`template-b` 的 `.sfc-template` 缺失。
- `updates Wevu template-generated computations and event handlers without replacing page state`：`edited` 的 `.derived-count` 缺失。

两者均已完成首屏和交互准备。构建输出包含新增节点，脚本客户端版本已推进；真实页面仍保留旧结构。产物写出和补丁确认不能代替真实 DOM 断言。

进一步对照：

- 单独执行冷启动后的 Wevu 两轮模板往返，同样在首次编辑失败；后续通过用例不能证明首次更新正确。
- 将原始 fixture 复制到全新独占项目后，首次 Wevu 模板更新仍失败，排除旧项目路径或历史项目缓存作为充分解释。
- 通过 Vite/Rolldown 原生 writer 只发布 Wevu 页 WXML，不发布脚本 delta，新增节点仍缺失；没有用手写文件修补产物。
- 原生 Page、原生 Component 的冷启动模板往返均通过。原生 Component 在启用 `multipleSlots`、移除子组件引用后也通过。
- 单独清除当前运行时模板指令缓存并触发原有数据更新，没有恢复新增节点。该探针保留原始失败，不计作验收通过。
- Computer Use 确认窗口为 Nightly、当前路径为 `pages/wevu/index`，计数和输入仍在，新增节点没有出现在真实模拟器中。

宿主日志显示，首次失败更新中 `transWXMLToJS` 请求先于该 WXML 的延迟缓存失效处理。安装代码中的文件事件合并器也采用延迟失效，编译读取路径未见对应的同步 flush。这是模板缓存竞争的诊断线索，尚不能单凭时序证明唯一根因；不据此新增固定等待、重复导航、预热编译或跳过断言。

原始日志、DOM 报告、截图、最小诊断代码和资源快照仅保存在本轮本地证据目录，公开文档不包含机器路径、账号标识或租约凭据。

## 两个 provider 的回归覆盖

已有 stateful HMR checkpoint 将逻辑状态与布局断言写在同一清单中，导致 headless 在进入 Wevu 主路径之前就拒绝包含计算样式的计划。

本轮仅让 checkpoint 接受明确的 provider：两侧保持相同路由、节点、文本、属性和顺序；真实 DevTools 保留全部原有样式与可见性断言，headless 验证对应逻辑节点。默认 provider 仍为 DevTools，不新增公开 API，也不改变构建或运行时行为。

继续复用独立的 `statefulHmrDom` 模块；大型 runtime suite 只调整调用参数，本轮没有向其中扩展功能块，因此不额外拆分文件。

## 收尾与继续条件

所有诊断入口沿用机器串行租约和单窗口受管流程。每次结束后核对所选安装进程树、登记窗口、journal 和机器租约；临时源码已恢复，原始失败证据保留。

筛选运行只能用于定位与补充验证。最终仍须在同一最终提交完整重跑正式 gate 和 full，完成所有计划内 task、case、checkpoint 和资源清理后，才能普通快进推送 main 并确认 Goal 完成。
