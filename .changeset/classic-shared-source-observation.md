---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复普通共享脚本热更新已写出产物但来源关联仍为 unknown 的问题。

通过打包器实际消费的脚本输入证明来源版本，保留入口原始输入、符号链接身份及构建代际隔离；不通过后置读取或旧事件补造关联。
