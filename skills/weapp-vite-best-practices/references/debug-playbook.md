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

### 分包 chunk 异常

- 确认 `sharedStrategy` 与 overrides
- 先看 analyze 输出，再决定是否加更多 override
