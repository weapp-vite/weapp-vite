---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `.weapp-vite` 支持文件未及时更新时的体验问题：在运行时检测到受管 tsconfig 等支持文件缺失或过期后，会先输出 warning，再自动执行一次与 `weapp-vite prepare` 等价的同步流程，减少模板项目因忘记 prepare 导致的类型异常。
