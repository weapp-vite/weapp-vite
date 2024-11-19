# 常见问题

## 为什么 `dist` 里面只有 `wxml`, 没有 `js`/`wxss`/`json`?

这通常发生在，你在 `pages` 里面创建了组件，但是没有在 `app.json` 的 `pages` 里面注册页面

这时候 `weapp-vite` 是不会去自动寻找依赖的，只会把 `wxml` 相关的文件进行处理和拷贝
