---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 移除内容热更新中不再需要的随机样式注释，让 App 与页面样式恢复到原始源码后保持产物一致；继续由编译器生成真实 CSS，并由原生发布阶段按最终内容去重，避免无变化样式重复写入。
