---
"@mpcore/simulator": patch
---

修复 headless 测试导航未消费宿主 fail 回调的问题，保留原始错误原因，避免导航失败后返回旧页面或仅报告空页面。
