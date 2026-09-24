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

## 最终模板转换

- 精确删除使用 `weapp.wxml.remove.attr: [{ tag: 'view', name: 'data-testid' }]`；修改、属性改名、标签转换使用 `weapp.wxml.transform(code, ctx)`，支持异步及函数数组。
- 推荐 `return ctx.edit(code, node => { if (node.tagName === 'view') node.removeAttribute('data-testid') })`；匹配最终静态标签名，Vue HTML 映射发生在此前。
- 字符串属性值是字面量，数字与布尔值保留类型；动态值写 `{ expression: 'value' }`，无值属性用 `setBooleanAttribute`。读取 `rawValue` 不代表运行时值。
- 编辑工具保护事件、平台指令、框架元数据和结构标签；原始字符串返回提供完整控制。替换自定义组件时必须自行注册，不自动改组件依赖。
- 子树编辑使用 `node.children`（直接子标签）和 `await node.walk(visitor)`（全部后代，不含自身）。手动 walk 不消费外层遍历；外层当前节点调用 `skipChildren()` 可避免再次处理。内层 skip 只影响内层遍历。父节点与 `validate` 中的 `node.children` 始终只读；删除父节点使全部后代句柄失效，不并发遍历或跨会话保存句柄。
- `transform` 在 `remove` 前执行，后续 Tailwind/compiler-plugin 仍能修改输出。显式注册外部依赖 `ctx.addWatchFile('rules.json')`，变化触发完整模板重建；不要依赖跨文件回调顺序或全局计数。

- 最终产物约束使用 `weapp.wxml.validate(code, ctx)`，支持同步／异步和顺序数组；它在 transform/remove 和框架输出插件之后、HMR 比较及发布之前执行，不修改源码。
- 使用 `await ctx.walk(node => { ... })` 观察只读节点，以 `ctx.report({ severity: 'warning' | 'error', message, code?, location? })` 报告结果；warning 允许发布，error 汇总后阻止输出。回调只能返回 undefined，不能返回模板字符串或 null。
- 校验位置是最终模板位置，`rawValue` 是原始绑定内容；不要把动态绑定当运行时值。外部规则读取前登记 `addWatchFile`，转换与校验共享监听但分别维护依赖；独立分包校验不在主包重复执行。
