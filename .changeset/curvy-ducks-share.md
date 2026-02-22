---
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 运行时的多平台条件裁剪链路：统一通过 `import.meta.env.PLATFORM` 选择小程序全局对象（`tt/my/wx`），并将相关 runtime 入口（组件定义、App 注册、hooks、template refs、页面生命周期）改为走平台适配层，避免非目标平台分支进入最终产物。同时补充 `weapp-vite` npm 构建 define 透传与 e2e 覆盖，分别验证 `wevu` 位于 `devDependencies` 与 `dependencies` 时的构建行为与平台输出。
