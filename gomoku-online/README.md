# Gomoku-Online

簡介 (中文)

- 五子棋（Gomoku）簡單網路對戰原型
- 支援：單人模式（本機AI） / 線上多人（WebSocket） / 觀戰
- 包含帳號註冊與登入、多房間大廳

Quickstart (English)

- A minimal Gomoku online prototype with: Solo (local AI), Online (WebSocket multiplayer), Spectate.

快速啟動 / Quick start

1. 安裝相依 / Install dependencies

```bash
cd /home/peterc20/.openclaw/workspace/gomoku-online
npm install
```

2. 啟動伺服器 / Start server

```bash
npm start
```

3. 開啟瀏覽器 / Open in browser

- 本機測試：http://localhost:3789
- If served behind HTTPS reverse proxy, enable WebSocket (Upgrade) in the proxy and the frontend will use wss://

Systemd (user-level) auto-start

You can enable an automatic user service so the server restarts after reboot/logon.

```bash
# create a user service file (example location: ~/.config/systemd/user/gomoku-online.service)
# ExecStart path uses the Node installed via nvm in this workspace

# then reload and enable
systemctl --user daemon-reload
systemctl --user enable --now gomoku-online.service
```

檔案說明 / Files

- server.js — Node.js + ws real-time server (includes register/login and room lobby)
- public/index.html — Frontend UI (solo/online/spectate + mobile-friendly)
- package.json — start script and deps
- users.json — local store for registered users (hashed passwords). DO NOT commit this file to public repos.

反向代理範例 (Nginx / Proxy Manager)

- Forward scheme: http
- Forward host: <your-host-ip>
- Forward port: 3789
- Make sure "WebSocket Support / Allow upgrade" is enabled

注意事項 / Notes

- For production: run behind a reverse proxy with TLS and enable systemd or container supervisor.
- Protect users.json; passwords are hashed but keep the file private.

License: MIT
