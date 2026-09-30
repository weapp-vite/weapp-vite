# 三入口纯 Web 目标

关联 #1097；承接六平台阶段，独立 CLI、普通 Vite 与 Vite+ 都通过 `weapp.platform: 'web'` 选择既有 Web runtime。

## 实现

- 公共平台配置增加 `web`，内部源码平台仍使用小程序平台类型；配置来源保留原始目标。
- 独立 CLI 在本次配置加载后选择 backend，显式 CLI 参数优先。配置选择纯 Web 时，build upload 在改版本和准备上传前拒绝。
- 配置归一化在纯 Web 路径避开小程序 CommonJS、入口与输出默认值，复用已有 Web 配置合并与 runtime provider。
- 标准插件使用工厂阶段固定的 Web 插件槽，配置阶段绑定实现。开发借用宿主服务，不创建第二个 Vite server 或微信 stateful 引擎。
- 主产物由宿主原生 bundle 写出，支持插件生产 watch、middleware 关闭和独立宿主。

## 验证

- 定向测试涵盖无小程序项目配置构建、单来源配置、CLI 覆盖、用户插件只执行一次、Web transform 失败恢复、middleware 双宿主关闭和生产 watch。
- 严格 tarball 消费：`wv`、`vite`、`vite-plus`，同一个多平台 SFC 模板；生产与 dev 浏览器验证平台分支、子组件、计数器和 computed，开发模板往返；Vite/Vite+ 另验证原生 build watch。
- 每次命令配置执行一次；纯 Web 只输出 `dist/web`，不要求 `project.config.json`。
- 本机 registry 返回 TLS 主机名错误，因此独立 npm 安装使用已有缓存的 offline 模式；保留 `--strict-peer-deps`、安装脚本与证书校验，未绕过 peer。CI 使用正常网络安装。
- Web 浏览器验收不代表任何小程序 IDE 验收。既有小程序消费 smoke 在每个发布包验证中同时执行。

## 边界与维护

- 本阶段支持既有纯 Web 目标；同宿主 Web/小程序环境混合仍明确拒绝。
- 独立 CLI 的 Web build watch 尚未在本阶段消费矩阵中开放验收，列入后续统一生命周期工作。
- 未调整 npm 自定义 builder、手工映射、artifact API 或脚手架；这些仍由总追踪项持续管理。
- 既有 `loadConfig.ts`、CLI build/serve 超过 300 行，本次变更仅增加目标归一化/选择边界；独立目标选择 helper 放在 `cli/runtime.ts`，避免同时重写上传和交互流程。Web 消费验证独立成脚本，未继续堆入安装入口。
