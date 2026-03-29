<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/view/tap.html -->

# Tap 事件

将用户在移动端手指按下后抬起、或在工具/PC 端按下鼠标后抬起定义为一次 tap 事件。tap 事件基本上是基于 web 标准的 touch 事件做的封装。

## 点击态

为防止敏感接口被滥用，部分 API 触发时会检查并消耗点击态（如 wx.openSetting、wx.requestSubscribeMessage），当点击态失效时，则对应功能会受到影响（调用失败或降级）。

每当用户点击时，相应 tap 事件的事件响应函数会获得点击态。除此之外，以下 API 的回调内也具有点击态：

- wx.requestPayment 与 wx.requestOrderPayment，但这两个 API 获得的点击态不可用于触发 wx.openEmbeddedMiniProgram，详情可见 [支付后打开半屏小程序能力的相关调整通知](https://developers.weixin.qq.com/community/develop/doc/000644871006f83372416ff2c66801) ；
- wx.showModal 与 wx.showActionSheet，点击态仅在 success 回调或接口调用成功后的 complete 中获取。

点击态只在当前事件响应函数所在的宏任务内有效。因此，setTimeout/setInterval 所包裹的函数不具备点击态，但 Promise/async/await 内有效。

由于 iOS 的 Promise 实现存在问题，小程序使用 polyfill 的 Promise。故 iOS 下使用 Promise/async/await 会失去点击态：

```
// <button bind:tap="handleTap">tap</button>
handleTap: async () => {
  // 点击态有效
  setTimeout(() => {
    // 失去点击态
  }, 100);
  Promise.resolve().then(() => {
    // Android 上具备点击态，iOS 上失去点击态
  });
};
```

在 tap 事件处理函数中进行异步请求是一个常见的行为。当 wx.request、wx.downloadFile 或 wx.getSetting 被调用时具有点击态，则会延续该点击态至 success/complete/fail 回调函数：

```
// <button bind:tap="handleTap">tap</button>
handleTap: async () => {
  // 点击态有效
  wx.request({
    url: "https://www.thissitedoesnotexist.com/step1",
    complete: () => {
      // 点击态有效
      wx.request({
        url: "https://www.thissitedoesnotexist.com/step2",
        complete: () => {
          // 点击态有效
        },
      });
    },
  });
};
```

单次 tap 生成的点击态被消耗之后，无法再延续点击态：

```
// <button bind:tap="handleTap">tap</button>
handleTap: async () => {
  // 点击态有效
  wx.openSettings({}); // 成功调用
  wx.request({
    url: "https://www.thissitedoesnotexist.com",
    complete: () => {
      // 失去点击态，因为点击态被 wx.openSettings 消耗掉了
    },
  });
  wx.openSettings({}); // 成功调用
};
```
