---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 stateful HMR 独立快照把内部原生侧车请求误判为外部 raw 资产的问题，侧车与原生入口共用冻结源码读取，避免同批次晚保存脚本造成构建失败。在资产提交时记录重叠保存的真实原生输入，收到延迟通知后通过完整构建持久化脚本，保留后续独立编辑的补丁更新。同时保留普通 raw/url 资产的字节与路径准入，并恢复同一快照 owner 的多个准入拒绝。
