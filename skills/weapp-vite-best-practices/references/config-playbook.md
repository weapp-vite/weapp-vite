# weapp-vite Config Playbook

## 最小起步

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
  },
})
```

## 常见增长路径

- 组件规模上来后再加 `autoImportComponents.globs/resolvers`
- 目录边界稳定后再加 `subPackages`
- 观察真实输出重复后再调 `chunks` 策略
- 需要局部验证时再加 `buildScope` 或 `--scope`，并检查主包/分包路由归属
- 多平台项目始终显式选择单个 `-p <platform>`，project config 放在稳定平台目录

## 分包决策提示

- 默认先用普通分包 + 默认 chunks
- 重复体积明显时考虑 `sharedStrategy: 'hoist'`
- 冷启动优先时保留 `duplicate`

## CI 提示

- build 与 IDE upload 分开
- `dist` 根目录与 `project.config.json` 保持一致
- 自动化场景优先非交互 CLI 参数
- sourcemap 验证要覆盖构建后 npm、平台 API 和 chunk 重写，不能只看 Vite 初始 map
- React 项目只在这里配置 `weapp.react`；render mode、Compiler 和 bridge 转交 React skill
