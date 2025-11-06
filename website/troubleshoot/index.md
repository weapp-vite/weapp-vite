# 常见问题排查

遇到构建或运行异常？先从以下问题入手自检，大多数情况都能在几分钟内定位原因。若仍未解决，可携带日志在 Issue 或社区群反馈。

## 构建产物里只有 WXML？

- **症状**：`dist/` 中只有 `.wxml`，缺失 `.js`、`.wxss`、`.json`。
- **常见原因**：页面未在 `app.json.pages` 注册，或组件缺少 `json.component = true`。
- **排查步骤**：
  1. 打开 `app.json` 是否包含该页面路径；
  2. 检查组件是否位于 `usingComponents`，以及是否具备同名 `.json`；
  3. 使用 [`weapp.debug.watchFiles`](/config/shared.md#weapp-debug) 输出监听列表确认扫描情况。

> [!TIP]
> 依赖扫描流程详见 [依赖分析扫描流程](/deep/scan.md)。了解入口判定规则可以更快定位遗漏。

## 目录结构正确仍报 `require()` 错误？

这通常是微信开发者工具缓存造成的。试试：

1. 在开发者工具中临时开启「将 JS 编译成 ES5」，触发一次重新编译；
2. 再关闭该选项并重启工具；
3. 若仍未恢复，可删除项目目录下的 `miniprogram_npm`、`dist` 后重新执行 `pnpm build`。

## 引入 UMD/CJS 模块时报错？

- 例如 `visactor` 的 `index-wx-simple.min.js` 体积较大并依赖 CommonJS，直接 `import` 会导致 ESM 分析失败。
- 解决方案：将文件重命名为 `.cjs` 或在源码中显式 `require()`，提示 bundler 将其按 CommonJS 处理。
- 参考案例：[issue #115](https://github.com/weapp-vite/weapp-vite/issues/115)。

## `custom-tab-bar` 不生效？

确保同时满足两点：

1. `custom-tab-bar/` 文件夹与 `app.json` 位于同级目录（例如二者都在 `src/` 下）。
2. `app.json.tabBar.custom` 设置为 `true`。

> [!NOTE]
> Skyline 的 [全局工具栏](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/appbar.html#%E4%BD%BF%E7%94%A8%E6%B5%81%E7%A8%8B) 也遵循同样的目录要求。

---

若以上方案未解决问题，请收集：

- 复现步骤与最小示例仓库；
- `pnpm build` 输出日志、微信开发者工具控制台日志；
- `vite.config.ts`、`app.json` 关键配置。

然后在 [GitHub Issues](https://github.com/weapp-vite/weapp-vite/issues) 或社区群提问，我们会尽快协助排查。
