# 常见问题

## 为什么 `dist` 里面只有 `wxml`, 没有 `js`/`wxss`/`json`?

这通常发生在，你在 `pages` 里面创建了组件，但是没有在 `app.json` 的 `pages` 里面注册页面

这时候 `weapp-vite` 是不会去自动寻找依赖的，只会把 `wxml` 相关的文件进行处理和拷贝

## 为什么明明目录结构都是对的，还是报 `require()` 的错误

这是由于微信开发者工具的缓存引起的问题。

可以尝试，开启微信开发者工具的 `将 js 编译成 es5` 选项，重新编译，然后再关闭即可恢复正常。

## 引入 umd / cjs 模块报错

比如之前遇到过引入 `visactor` 的小程序 `sdk` `index-wx-simple.min.js` 报错的问题

我们需要手动把 `index-wx-simple.min.js` 重命名为 `index-wx-simple.min.cjs` (`js` -> `cjs`)

从而告诉 `vite` 这是一个 `cjs` 模块, 详见 [weapp-vite/issues/115](https://github.com/weapp-vite/weapp-vite/issues/115)
