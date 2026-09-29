# 六平台三入口阶段

三入口共享顶层 `weapp.platform`，保持每次一个小程序目标。独立 wv 继续支持 CLI 平台覆盖；原生 vite/vp 不增加专属参数。阶段依赖组件库 PR #1111，完整能力对齐由 #1097 继续追踪。

## 实现

- 移除微信单平台宿主门禁，复用六平台原生与 Vue 编译器；显式平台选择在配置默认值合并前识别，避免把隐式微信默认值当作用户选择。
- 补齐内联项目配置插件槽；目录式配置随原生写出阶段发布到平台项目根，生产 watch 追踪目录成员和内容变化、清理已拥有文件。配置不得覆盖小程序编译目录。
- stateful 的内存快照保持不写最终输出；平台项目配置在共享开发会话中通过配套原生引擎发布。非微信 stateful 明确拒绝。
- 目录式配置暂不支持内存构建，内联配置支持；配置目录中的符号链接尚未支持。Web、自定义 npm/手工映射及完整高级平台组合后续继续对齐。

## 验证

- 5 文件累计 179 项定向测试通过（首轮 177 项，平台新增 stateful/内存测试后该文件 17 项通过）。包含六平台原生编译与 classic、目录发布、watch 更新/删除、输出冲突保护、微信 stateful 与内存配置发布。
- 包级 typecheck、test:types、build、ESLint 与网站构建通过；suite manifest 32 项、共享 automator 147 文件检查通过。
- 同一多平台 SFC 模板分别经 wv、vite、vite-plus 独立 tarball 严格 peer 安装；每入口六平台生产和 classic 通过，vite/vp 另通过生产 watch 更新及立即恢复，配置均仅执行一次。
- 每入口微信 headless 与真实 IDE 各 1 场景通过：平台注入、SFC 组件首屏、点击后派生状态、页面重入；runtime error/exception 为 0。其他平台未宣称完成真实 IDE runtime 验收。
- 消费脚本使用普通 npm 模式，隔离尚待实现的手工 npm 输出映射；没有绕过 peer 校验。

可复现：

```sh
pnpm --filter weapp-vite build
node packages/weapp-vite/scripts/verify-vite-host-install.mjs wv both platform
node packages/weapp-vite/scripts/verify-vite-host-install.mjs vite both platform
node packages/weapp-vite/scripts/verify-vite-host-install.mjs vite-plus both platform
```

所有消费与 runtime 命令串行。CI 新增三入口六平台构建及微信 headless 矩阵。现有大文件仅接入阶段调用与消费 profile，平台发布与消费编排放入独立模块，避免进一步扩大核心实现文件。
