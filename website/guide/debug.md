# 调试与贡献

这份指南面向想要参与 `weapp-vite` 开发或排查源码问题的伙伴。按照下面的步骤准备环境，就可以在本地命中断点、验证修改，并把贡献发送到社区。

## 1. Fork 与克隆仓库

1. 登陆 GitHub，访问 [`weapp-vite`](https://github.com/weapp-vite/weapp-vite) 仓库。
2. 点击右上角 **Fork**（或直接访问 [快捷链接](https://github.com/weapp-vite/weapp-vite/fork)），选择目标账号并命名仓库。
3. 完成后，在本机克隆你自己的 Fork：

```sh
git clone https://github.com/<your-name>/weapp-vite.git
cd weapp-vite
```

> [!TIP]
> 首次 Fork 后建议添加上游仓库，后续可以方便地同步最新改动：
>
> ```sh
> git remote add upstream https://github.com/weapp-vite/weapp-vite.git
> ```

## 2. 安装依赖并准备调试

1. `package.json` 中记录了推荐的包管理器版本，例如：
   ```json
   {
     "packageManager": "pnpm@9.7.1"
   }
   ```
   建议执行 `corepack enable`，确保使用与仓库一致的工具链。
2. 在仓库根目录安装依赖：
   ```sh
   pnpm install
   ```
3. 仓库内的 `apps/` 目录准备了多个演示项目（`vite-native`、`vite-native-skyline` 等），可以任选一个作为调试入口。
4. VS Code 用户可以直接使用仓库内置的 `.vscode/launch.json`，也可以在“调试和运行”面板选择需要的配置，一键启动并命中 TypeScript 源码断点。

![](../images/vscode-debug.png)

> [!NOTE]
> 如果你更喜欢终端调试，也可以运行 `pnpm --filter apps/vite-native dev` 再配合浏览器/IDE 附加调试，会同样命中源码断点。

## 3. 提交贡献

1. 在本地创建分支并完成改动，写好测试或文档：
   ```sh
   git checkout -b fix/my-change
   pnpm lint --filter ...
   pnpm test --filter ...
   ```
2. 提交后推送到自己的 Fork：
   ```sh
   git push origin fix/my-change
   ```
3. 打开仓库的 **Pull requests** 页面，点击 **New pull request**，选择你的分支 → 上游 `main`。
4. 在 PR 模板中说明动机、做了哪些验证，并附上截图或日志（如果适用）。

提交后维护者会安排 Review，并和你沟通改进建议。PR 合并后，你的代码就会出现在所有使用 weapp-vite 的团队中 🎉。

> [!TIP]
> 想持续参与社区？欢迎在 Issue 区挑选 `good first issue`、`help wanted` 标签的任务，也可以加入讨论区提出想法。
