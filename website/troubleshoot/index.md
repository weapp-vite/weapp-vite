# 常见问题排查

遇到构建或运行异常？先从以下问题入手自检，大多数情况都能在几分钟内定位原因。若仍未解决，可携带日志在 Issue 或社区群反馈。

<a id="watch-limit"></a>

## 启动开发时出现 `EMFILE` / `ENOSPC` 或 `unable to start FSEvent stream`？

- **症状**：执行 `pnpm dev` / `pnpm dev:open` 时报监听相关错误，例如：
  - `EMFILE: too many open files`
  - `ENOSPC: System limit for number of file watchers reached`
  - `unable to start FSEvent stream`
- **原因**：系统文件描述符或文件监听器上限不足，构建器无法继续创建 watch。

### 临时处理（当前终端生效）

macOS / Linux 可先执行：

```bash
ulimit -n 65536
```

然后重新运行 `pnpm dev`。

### 长期处理（推荐）

#### macOS

1. 新建并加载 `launchd` 配置（将软/硬限制都提到 `65536`）：

```bash
sudo tee /Library/LaunchDaemons/limit.maxfiles.plist >/dev/null <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>limit.maxfiles</string>
    <key>ProgramArguments</key>
    <array>
      <string>launchctl</string>
      <string>limit</string>
      <string>maxfiles</string>
      <string>65536</string>
      <string>65536</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>ServiceIPC</key>
    <false/>
  </dict>
</plist>
EOF

sudo launchctl bootstrap system /Library/LaunchDaemons/limit.maxfiles.plist
sudo launchctl enable system/limit.maxfiles
```

2. 重启系统后，用 `ulimit -n` 或 `launchctl limit maxfiles` 检查是否生效。

#### Linux（inotify 上限）

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
echo fs.inotify.max_user_instances=1024 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 仍有问题时建议一并检查

1. 是否在同一终端里重复启动了多个 `pnpm dev`；
2. 微信开发者工具是否打开了过多项目；
3. 项目根目录是否包含超大体量临时文件且未被忽略。

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
