## Vue Type Configuration Guard

- `tsconfig.json` 必须保留浏览器 DOM lib：
  - `ESNext`
  - `DOM`
  - `DOM.Iterable`
- `vueCompilerOptions` 必须保持 Web Vue 配置：
  - `plugins: []`
  - `lib: "vue"`
- 不要让根目录面向小程序/wevu 的 Volar 插件配置泄漏到本包，否则模板里的 `div`、`button`、`select`、`table` 等 Web 标签会被错误地按小程序组件检查。
