---
"weapp-vite": patch
"create-weapp-vite": patch
---

状态保持 HMR 在发布脚本补丁前完成对应批次的样式提交，避免样式写入失败后仍发布补丁或通知已交付，并保持后续完整重同步恢复能力。
