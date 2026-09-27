# #1086：原生模板限制与独立脚本状态验收

## 原生完整文件对照

微信开发者工具 2.02.2609231、实际基础库 3.16.3，与原 Wevu 首次模板失败运行一致。项目只有原生 App/Component、WXML/JSON/WXSS；不加载框架、bundler 或 automator。初始六个源码文件齐全，WXSS 从首次启动即存在。

真实 UI 把 count/store-count 准备为 2、输入改为 held-input。只编辑 WXML，新增 derived-count 表达式和 advance 按钮，同时移动动态 style 绑定位置。原生 selector query 仍查不到新增节点（0），原 increment 节点仍为 1。正常点击旧按钮后 count/store-count 为 3，输入和实例保持，新增节点仍为 0。一次普通菜单“编译”后，count 重置为 0，derived-count 显示 1，advance 出现。编译前后六个源码文件的字节 hash、大小和 mtime 全部相同。

此前未包含 WXSS 的原生尝试保留为历史材料；本次完整文件对照排除了 IDE 首次生成缺失 WXSS 的干扰。该对照独立证明当前 IDE/SDK 存在模板结构热更新未生效的宿主限制，不能将原 Wevu 缺节点归为框架特有失败。尚未唯一定位 IDE 内部缓存/编译/注入的具体分支，原模板自动化失败仍保留，未改写成通过，也未增加预热、额外 touch、强制 apply 或重写产物。

## 独立脚本更新与恢复

新增 provider-compatible 场景排在首次模板场景之后，可单选冷态运行；仅修改脚本 marker 与本地/store 递增步长，不改变模板、样式或 schema 默认值。六个严格 DOM 检查点覆盖 initial、prepared、patched、clicked、restored、restored-clicked。count 为 0→2→2→4→4→5，store 按初始偏移同步变化；输入、路由/query、实例标记保持，编辑及恢复均等待精确客户端版本。

- 真实 DevTools / SDK 3.16.3：1 case PASS，6/6 DOM。首次命令使用 headless 配置却未选择 provider，实际运行的是 devtools；报告明确记录实际 provider，不能将此结果记成 headless。启动协议重试原样保留。
- 随后显式选择 headless：1 case PASS，6/6 DOM。
- mpcore 使用真实 DevEngine 生成的 Vue 补丁及共享 store，连续 +2/+3/恢复 +1；Node/browser session 两项通过，真实浏览器一项通过，类型检查通过。虚拟 TypeScript store 首次被按 JS 解析的测试装配错误保留，已以正确 moduleType 修正。

headless gate 新增该场景并锁定覆盖清单，原完整 Wevu 和首次模板断言不变。测试文件已有超过 300 行，本次只挂载共享会话 case，DOM 计划拆入独立 helper，避免为单场景新增重复 automator 会话。此次仅测试与证据变更，无产品源码变化、无新增 changeset；原中文 weapp-vite/create-weapp-vite changeset 保留，dist 延用已重建的同一产品。

## 合并口径

按用户已确认的“Nightly 非阻断、产品修复后合并、已证实宿主限制可记录接受”处理。TDesign 完整默认 layout 的脚本/主题/颜色交互及原生页面栈镜像对照见[前份报告](./issue1082-native-context-and-startup.md)。冷启动延迟已定位在产品入口执行之前；普通编译使用完全相同产物恢复，具体宿主触发条件仍保留在 #1082 跟踪。当前记录不宣称所有真实 IDE suite 全绿，也不关闭 #1081/#1082。最终合并仍须本次最终 HEAD 普通 CI 全绿。

[完整脱敏归档](./issue1082-native-template-and-script-state.json.gz)：17 份记录，解压 216043 bytes，SHA256 `6b1ccdc38b72742ad59d6b1b271c5de93982e3a7cacc6e7f07272934240499d0`。原始 SHA 单列；原件继续保留本地。

## 最终 CI 的共享会话清理回归

`71371b19a` 三系统 headless 均在新增脚本场景失败：此前模板用例通过，客户端却停在旧版本、服务端返回 rebuilding。完整本地七场景顺序稳定复现。trace 显示 Component 模板已经恢复并验收后，finally 再次原子替换相同 WXML；多余事件与下一次 Vue 更新合批，按既有非脚本安全边界触发 full build。模板 DOM 仍能继续刷新，直到新增脚本场景等待客户端版本才暴露旧会话。

清理改为只在源文件尚未恢复时执行；没有调整产品安全判断、等待时间或 DOM 断言。相同顺序修正后 7 cases PASS、43/43 DOM，22.66s。临时失败日志观察器已经恢复。此前单选两 provider 的通过仍成立，不能替代这次完整共享会话回归。

[三系统失败、真实源事件 trace 与修正后完整记录](./issue1082-shared-session-cleanup.json.gz)：解压 1819839 bytes，SHA256 `ae94a8410fddc994c392c989c84b5a5e2c7b94b2330c4de61068ec4456b78ade`。

清理修正后再以正式 devtools 配置运行原生 Page/Component 模板往返及 Wevu 独立脚本三场景：3 PASS、18/18 DOM。此对照未包含已记录宿主限制的 Wevu 首次模板场景，不替代或删除其历史失败。
