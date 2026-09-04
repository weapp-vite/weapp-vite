---
'create-weapp-vite': patch
'wevu': patch
---

补全 Wevu 异常卸载边界：template ref、setup scope 与生命周期回调抛错时仍完成后续资源清理，并防止 teardown 期间创建的子 scope 泄漏。
