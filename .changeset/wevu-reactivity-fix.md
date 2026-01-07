---
"wevu": patch
---

修复响应式相关问题：

- `triggerEffects` 迭代时复制依赖集合，避免自触发死循环
- `triggerRef` 直接触发依赖，确保在值不变时也能更新
- `watch` 监听 reactive 源时默认走 deep 策略，保持行为一致
