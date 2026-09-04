---
'create-weapp-vite': patch
'wevu': patch
---

修复 Wevu effectScope 与运行时实例的卸载可靠性：单个 effect、cleanup、子 scope 或 runtime unmount 抛错时继续完成其余资源释放和内部实例字段清理，并在结束后保留首个错误供调用方处理。
