# Contributing

## 开发环境

仓库源码构建使用 `tsdown@0.23.0`，需要 Node.js `^22.18.0 || ^24.11.0 || >=26.0.0`。

## 依赖升级

工作区依赖升级统一使用：

```bash
pnpm deps:up
```

该命令会完成依赖更新、锁文件整理、catalog/模板同步和 changeset 生成。普通安装只恢复依赖，不会改写受 Git 跟踪的 manifest 或生成 catalog：

```bash
pnpm i
```

如果直接执行 `pnpm up` 后看到 catalog 同步提示，请改用 `pnpm deps:up` 或显式运行 `pnpm run catalog:sync:workspace`。

## Git 索引锁

提交时报 `.git/index.lock` 时，先检查是否仍有 Git 进程：

```bash
pnpm git:index-lock:doctor
```

只有确认没有活动 Git 进程且锁文件已超过安全时间阈值后，才使用：

```bash
pnpm git:index-lock:clean
```

工具不会自动删除活动中的索引锁。
