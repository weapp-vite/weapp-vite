<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/js-support.html -->

# JavaScript 支持情况

## 运行限制

基于安全考虑，小程序中不支持动态执行 JS 代码，即：

- 不支持使用 `eval` 执行 JS 代码
- 不支持使用 `new Function` 创建函数
    - `new Function('return this')` 除外

## 标准 ECMAScript 支持

小程序的 JS [执行环境](./env/README.md) 在不同平台上的执行环境存在差异，因此导致不同平台对 ECMAScript 标准的支持存在差异。

小程序基础库为了尽量抹平这些差异，内置了一份 [`core-js` Polyfill](https://github.com/zloirock/core-js) 。 `core-js` 可以将平台环境缺失的标准 API 补齐。

需要注意的是，平台对 ECMAScript 语法的支持差异无法抹平，当你需要使用一些高级语法时，如 [`async/await`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/async_function) 时，则需要借助 [代码转换工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/codecompile.html#es6-%E8%BD%AC-es5) 来支持这些语法。

### 无法被 Polyfill 的 API

以下 API 在部分低版本客户端中无法使用，请注意尽量避免使用

- `Proxy` 对象

## 与标准的差异

### Promise 时序差异

由于 iOS JavaScriptCore 的限制，iOS 15 及以下的 `Promise` 是一个使用 `setTimeout` 模拟的 Polyfill。这意味着 `Promise` 触发的任务为普通任务，而非微任务，进而导致 **在 iOS15 及以下的 `Promise` 时序会和标准存在差异** 。

iOS 16 及以上不存在差异。

```javascript
var arr = []

setTimeout(() => arr.push(6), 0)
arr.push(1)
const p = new Promise(resolve => {
  arr.push(2)
  resolve()
})
arr.push(3)
p.then(() => arr.push(5))
arr.push(4)
setTimeout(() => arr.push(7), 0)

setTimeout(() => {
  // 应该输出 [1,2,3,4,5,6,7]
  // 在 iOS15 小程序环境，这里会输出 [1,2,3,4,6,5,7]
  console.log(arr)
}, 1000)
```

关于普通任务和微任务的区别可以查看 [这篇文章](https://developer.mozilla.org/zh-CN/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth)

## 如何判断当前环境需要哪些 Polyfill & 代码转换目标

特定的小程序基础库版本有最低微信客户端版本要求，如基础库 v2.15.0 要求安卓最低版本 7.0.22，iOS 最低版本 7.0.20。

而特定的客户端版本有最低操作系统版本要求，如 iOS 7.0.20 要求最低 iOS 10。

从而，当指定特定小程序基础库版本时（可以在 [小程序管理页](https://mp.weixin.qq.com/) 【设置】-【基本设置】-【基础库最低版本设置】中设置），我们能够得到最低需要支持的执行环境。

具体数据可以从 [这个开源库](https://github.com/wechat-miniprogram/miniprogram-compat) 中获得。
