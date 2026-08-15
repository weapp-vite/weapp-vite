# weapp-vite Debug Playbook

## 症状 -> 第一检查点

### 页面或路由缺失

- 检查 `srcRoot`
- 检查页面目录结构
- 检查 `autoRoutes` 与生成的 route typings

### 组件未解析

- 检查组件目标与路径大小写
- 检查 `autoImportComponents.globs/resolvers`

### 构建输出位置不对

- 检查 `project.config.json`
- 检查 `build.outDir`
- 检查小程序输出根目录假设

### 支付宝或抖音原生文件缺失

- 确认使用了正确的 `-p alipay|tt` 和平台描述符
- 检查 `.axml/.acss`、`.ttml/.ttss` 与 script module 扩展名
- 不复制或重命名成微信扩展名掩盖扫描问题

### scoped build 路由漂移

- 检查 `weapp.buildScope` / `--scope` 与 autoRoutes 的分包 root
- 确认目标分包页面没有被加入主包或重复构建

### 分包 chunk 异常

- 确认 `sharedStrategy` 与 overrides
- 先看 analyze 输出，再决定是否加更多 override

### HMR 慢或热更新不稳定

- 先看 `weapp.hmr.sharedChunks` 与 `touchAppWxss`
- 临时设置 `weapp.hmr.logLevel: 'concise' | 'verbose'`
- 需要结构化复盘时打开 `weapp.hmr.profileJson`

### sourcemap 指向旧代码

- 检查 CLI `--sourcemap` 是否透传
- 检查 npm 本地化、平台 API、shared chunk 与入口注入重写是否组合旧 map
