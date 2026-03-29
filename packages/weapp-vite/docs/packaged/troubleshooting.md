# Troubleshooting

## `.weapp-vite` 支持文件缺失或过期

现象：

- 终端提示支持文件缺失或已过期
- 类型提示异常
- Volar / TypeScript 行为不一致

优先操作：

```bash
weapp-vite prepare
```

## AI 截图失败

优先检查：

1. 微信开发者工具是否已登录
2. 是否开启了「设置 -> 安全设置 -> 服务端口」
3. `--project` 是否指向真实的小程序构建目录
4. `--page` 是否为真实路由

推荐命令：

```bash
weapp-vite screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
```

## 终端里看不到小程序日志

优先使用：

```bash
weapp-vite ide logs --open
```

如果项目启用了 `weapp.forwardConsole.enabled = 'auto'`，AI 终端场景下 `dev --open` 也可能自动附加日志桥。

## `.vue` 文件存在，但提示未安装 `wevu`

这通常意味着项目启用了 Vue SFC，但依赖侧没有满足当前约束。

优先确认：

1. 是否真的在使用 `wevu`
2. 当前项目依赖是否完整安装
3. SFC 相关写法是否应该参考 [`vue-sfc.md`](./vue-sfc.md)

## 下游验证与源码修改不一致

如果你正在修改 `packages/weapp-vite/src/**`，而验证走的是 app/template/e2e 产物，优先怀疑 `dist` 产物陈旧。

先重建：

```bash
pnpm --filter weapp-vite build
```

再做下游验证。
