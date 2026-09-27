# #1086：原生页面镜像与首次启动边界

本轮产品为 `0ade2b6dfac898ee96d0627c50e3f68222f94f26`，普通 CI 31 success / 10 skipped。#1092 已按授权 squash 合入 `dfc6f3e40a05e46cd2ca2566184431f505307c5f`；本 PR 已普通合入该 main。Nightly 仍非阻断，真实 Wevu 模板验收未通过，PR 保持草稿。

## 已独立确认的页面镜像差异

真实 IDE 2.02.2609231、实际 SDK 3.17.3。完整默认 layout 的 TDesign 在一次正常菜单编译后，脚本更新/恢复版本为 0→1→2，实际点击依次显示 dark、npm-dark、light，颜色 HMR 实测为 rgb(16,185,129)。App 启动标记不变。新探针同时读取 onLoad 捕获对象、事件 this、页面栈和 HMR 跟踪对象：初始点击时相同，HMR 后事件 this 与页面栈对象分离。事件 this 和 bridge 的数据为新 npm-dark/light，页面栈及旧 onLoad 对象仍为 dark。没有同步或篡改这些数据。

不加载框架、bundler 或 automator 的原生源码项目独立复现了相同 SDK 行为：初始点击三方数据一致；普通 WXML 修改能显示 PATCHED，引用仍一致；原生 JS 文件修改后 SDK 重建 Page，点击新方法显示 npm-dark，新 onLoad/事件读值正确，但 getCurrentPages 仍返回旧 dark 对象。App 标记未变。该对照确认当前 IDE 原生脚本热重载存在页面栈镜像陈旧问题，不能把页面栈引用未变直接等同于所有原生实例未变。另观察到原生 WXSS 修改未改变计算背景色，未将其与其他样式失败直接归为同一内部原因。

## 首次启动边界

TDesign 首次仍为空白。一次普通 IDE 编译前后，1212 个产物的字节 hash、大小与 mtime 完全一致，编译后页面出现。独立的最新 main 构建也复现首次空白；最小原生默认 layout 与注册转发/Component 队列对照能首次显示，未证明简单注册包装必然导致失败。

临时正常构建探针记录：CLI 打开到 App 第一行约 50.339 秒；control 请求同步返回耗时 4ms，runtime 初始化约 1ms，产品入口到 App onLaunch 总计仅 6ms。IDE 的 RouteController 已先记录 10 秒路由超时；失败时桥中仅注册 App，Page/layout 入口没有执行。延迟发生在产品入口之前，不能归因于 Page 注册回调中的死循环。宿主内部资源交付延迟的具体触发条件仍未完全定位，不据此宣称所有首次启动问题均已修复。

## 未通过的模板对照

- 临时等待已有快照完成后再发布 JS：headless 新计算/事件场景 6/6；真实 SDK 3.16.3 仍在 edited 缺少 derived-count，2/6。单独改变发布先后未解决问题。
- SDK 直接打开原生构建输出目录，配置同样由 generateBundle/emitFile 生成，无第二个 bundle 写入者：headless 6/6；真实 SDK 3.16.3 仍 2/6。不能单独归因于 SDK 看到外部源目录。
- 临时匹配 SDK 3.17.3 后也记录 2/6；但后续发现另一仓库 E2E，未取得准确开始时间，不能确认整段独占。这次失败保留，不单凭它确定版本因果。

所有临时产品、suite、fixture 配置均已恢复，受影响 dist 已重新构建。原断言、默认 layout、轮询和超时均未放宽，未提交诊断探针，无额外 changeset。上述 Computer Use 结果是明确标注的人工交互记录，不冒充原自动化 suite 全部通过。

[完整脱敏记录](./issue1082-native-context-and-startup.json.gz)：53 份材料，解压 1836413 bytes，SHA256 `b6225aaf7aa4e03f33b597c4cbe6d384f88c1120f244a72b21679c0c30919aea`。原始 SHA 单列，原件保留本地；未包含完整安装 IDE 源码或第三方模板工厂。
