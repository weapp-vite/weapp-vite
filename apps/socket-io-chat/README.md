# Socket.IO Chat

一个包含 Socket.IO 服务端、Web 端和 weapp-vite 小程序端的微信聊天风格示例。

## 启动

```bash
pnpm --filter socket-io-chat server
pnpm --filter socket-io-chat dev:web
pnpm --filter socket-io-chat dev:mini
```

默认服务地址是 `http://127.0.0.1:3001`。Web 端可通过 `VITE_SOCKET_URL` 覆盖，小程序端可通过 `WEAPP_SOCKET_URL` 覆盖。

小程序端直接从 `socket.io-client` 导入 `io`，由 weapp-vite 负责小程序运行时所需的请求与 WebSocket 兼容注入。
