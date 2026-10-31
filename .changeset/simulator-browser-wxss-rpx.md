---
"@mpcore/simulator": patch
---

fix(simulator): 修复浏览器预览的 WXSS rpx 换算

页面 WXSS 与导入样式按模拟设备视口宽度转换 rpx，设备尺寸变化后重新计算，保留字符串、URL 和原始虚拟文件内容。为页面样式解析 API 增加可选 `viewportWidth`，并补充单位转换、视口切换、浏览器布局与类型契约覆盖。
