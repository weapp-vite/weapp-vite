---
"weapp-vite": minor
"create-weapp-vite": patch
---

为微信状态保持 HMR 增加编译批次交付协议：样式提交成功后再发布对应补丁，并在客户端执行确认后通知 DevEngine。内置 Tailwind 集成使用固定源码视图和编译快照转换同批次的样式与 JavaScript，支持失败重试、未变化样式跳过写入及补丁 sourcemap 组合。第三方编译插件可通过可选的 prepareHmr 接口参与批次编译。
