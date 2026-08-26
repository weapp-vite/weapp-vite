# weapp-vite-plugin-template

## 1.0.0

### Patch Changes

- 完善 glass-easel 全链路兼容：补齐宿主 JSON schema 与显式启用配置，统一 WXML 序列化和旧指令归一化，新增 `wv analyze --glass-easel-check` 稳定诊断，并扩展组件泛型、插件产物与 DevTools/headless 插件运行时回归。WebView glass-easel 保持为基础库 `3.8.12` 以上由用户主动开启的兼容方案，脚手架不默认启用。
