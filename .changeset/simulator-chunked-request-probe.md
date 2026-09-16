---
'@mpcore/simulator': minor
---

为请求 mock 补充分块、响应头监听和取消契约，支持显式配置分块及连接失败，保持默认无网络访问。enableChunked 模式按真实微信 DevTools 观测通过分块回调交付数据，成功回调的 data 为空字符串；补齐 RequestTask 监听与解绑类型。
