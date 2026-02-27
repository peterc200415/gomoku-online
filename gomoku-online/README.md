# Gomoku-Online

簡介

- 五子棋（Gomoku）簡單網路對戰原型
- 支援：單人模式（本機AI） / 線上多人（WebSocket） / 觀戰
- 包含帳號註冊與登入、多房間大廳

快速啟動

1. 安裝相依

```bash
cd /home/peterc20/.openclaw/workspace/gomoku-online
npm install
```

2. 啟動伺服器

```bash
npm start
```

3. 開啟瀏覽器

- 本機測試：http://localhost:3789
- 若透過反向代理（HTTPS），確保 Nginx/Proxy 開啟 WebSocket 支援，前端會自動改用 wss://

檔案說明

- server.js — Node.js + ws 即時伺服器（含帳號註冊/登入、房間管理）
- public/index.html — 前端 UI（含單人/線上/觀戰與 mobile-friendly）
- package.json — 啟動腳本與相依
- users.json — 本機暫存註冊帳號（請勿上傳至公開 repo）

注意事項

- production：請使用 process manager（systemd）或 container 來管理服務
- 隱私：users.json 中儲存 hash 過的密碼，請妥善保護檔案

License: MIT
