# Socket.IO Chat

一个包含 Socket.IO 服务端、Web 端和 weapp-vite 小程序端的微信聊天风格示例。

示例同时包含三类请求客户端页面：

- Axios：联系人档案页，调用 `/api/contact`。
- Fetch：朋友圈动态页，调用 `/api/moments`。
- graphql-request：会话洞察页，调用 `/graphql`。

## 启动

```bash
pnpm --filter socket-io-chat dev
```

`dev` 会同时启动 Socket.IO 服务端和 Web 端，并在终端打印服务端、Web 首页以及 Axios / Fetch / GraphQL 三个请求客户端页面的 URL。微信小程序端不随 `dev` 启动，需要时可单独运行 `pnpm --filter socket-io-chat dev:mini`。

默认服务地址是 `http://127.0.0.1:3001`。Web 端可通过 `VITE_SOCKET_URL` / `VITE_API_URL` 覆盖，小程序端可通过 `WEAPP_SOCKET_URL` / `WEAPP_API_URL` 覆盖。

小程序端直接从 `socket.io-client` 导入 `io`，由 weapp-vite 负责小程序运行时所需的请求与 WebSocket 兼容注入。
