# Web Runtime Compatibility

- Web runtime 用来验证跨平台渲染和 Web API 适配，不等价于微信 DevTools 或真机。
- URL、URLSearchParams、fetch/request globals 需要在目标 runtime 做最小验证；浏览器通过不代表宿主通过。
- 第三方请求客户端若只在 DevTools 失败，先缩小到宿主构造器兼容问题，再决定 skip、polyfill 或业务修复。
