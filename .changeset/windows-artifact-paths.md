---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Windows 下测试产物监听混用路径分隔符与设备路径别名时的目录边界判断，正确识别 `..cache` 等合法子目录，避免重复监听源码子文件或监听生成目录，并保留显式输入目录。
