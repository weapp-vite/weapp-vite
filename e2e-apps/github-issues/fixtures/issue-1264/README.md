# Issue #1264：simulator 基础微信 API

独立原生页面直接调用 `wx.login`、`wx.getAccountInfoSync`、`wx.arrayBufferToBase64` 和 `wx.base64ToArrayBuffer`。页面显示登录结果与异步回调顺序、账号字段有效性、空输入及全部 256 个字节的编码回转结果。

`_probeContract()` 与 `_runContract()` 共用正常输入的观测函数；前者单独调用诊断函数，额外返回非法输入、空白、缺少 padding 和 TypedArray 切片的观测，供真实微信运行时对齐使用，不暴露登录 code。`_runContract()` 只执行正常输入，供 headless 与 DevTools 共用的 runtime suite 验收。登录相关协议调用固定 20 秒预算并关闭 fallback，避免超时后重复调用。
