# Plugin Build Playbook

## 配置

设置 `weapp.pluginRoot` 指向包含 `plugin.json` 的插件源码目录。host 源码仍由 `srcRoot` 管理。

## 验证

- 结构或入口变化后同时检查 `dist/` 和插件 `dist-plugin/`。
- plugin AppID/provider 变化时同步 project config 与插件声明。
- 共享模块可以从 host 和 plugin 入口引用，但必须分别验证输出路径。
