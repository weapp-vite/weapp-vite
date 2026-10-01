---
"weapp-vite": patch
"create-weapp-vite": patch
---

在库模式构建的输入阶段登记声明文件依赖，修复生产 watch 首轮文件已写出但发布尚未结束时的类型更新遗漏，并保留语法错误后的恢复能力。
