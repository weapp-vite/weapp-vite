---
"weapp-ide-cli": patch
---

fix(weapp-ide-cli): 将交互式终端中的配置文件和 CLI 路径提示改为可识别的文件地址，支持包含空格、中文及特殊字符的路径。在 macOS Terminal 中可按 Command 双击打开对应文件，重定向日志与配置数据继续保留原始路径。
