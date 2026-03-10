# Gomoku-Online

五子棋（Gomoku）網路對戰平台
A modern Gomoku online prototype with a premium UI and strong AI engine.

## 核心功能 (Features)

- **深色星空美學 UI (Modern Dark Theme)**: 採用 Glassmorphism (毛玻璃)、漸層按鈕、發光動畫與高品質實體感棋子。
- **強大的人工智慧 (Strong AI)**:
  - **簡單 (Easy)**: 具備基礎防守意識的入門難度。
  - **中等 (Medium)**: 採用連珠棋型評分（活四、活三等）的 1-ply 搜尋。
  - **困難 (Hard)**: 深度探索 (Depth 4) 的 Minimax 演算法，搭載 Alpha-Beta 剪枝、候選步優化與即時威脅判定，極具挑戰性。
- **多人連線 (Online Multiplayer)**: 基於 WebSocket 的即時對戰。支援註冊登入與多房間大廳。
- **觀戰模式 (Spectator Mode)**: 支援以旁觀者身分即時觀看任意房間戰局。
- **自適應設計 (Responsive)**: 支援手機與桌面瀏覽器的完美呈現。

## 快速啟動 / Quick start

1. **安裝相依 / Install dependencies**
```bash
cd /home/peterc20/opencode/gomoku-online
npm install
```

2. **啟動伺服器 / Start server**
```bash
npm start
```
*或是使用系統服務常駐啟動 (Systemd)*

3. **開啟瀏覽器 / Open in browser**
本機測試：http://localhost:3789
區網測試：http://<your-ip>:3789

## 專案結構 / Project Structure

- `server.js` — Node.js + ws 後端伺服器 (包含註冊/登入與房間管理)
- `public/index.html` — 前端 UI 外殼
- `public/style.css` — 現代化深色主題與毛玻璃樣式
- `public/app.js` — 前端邏輯、Canvas 棋盤渲染與 WebSocket 連線管理
- `public/ai.js` — 核心五子棋人工智慧引擎 (Pattern-based Minimax)
- `package.json` — 專案設定與套件依賴
- `users.json` — 本地儲存的註冊使用者資料 (密碼已 Hash 化處理)，請勿將此檔案 commit。

## Systemd (user-level) 自動啟動設定

如果希望開機後服務自動在背景運行，可以使用 user service：

```bash
# 修改 ~/.config/systemd/user/gomoku-online.service 
# 確認 WorkingDirectory 指向正確的路徑 (e.g. /home/peterc20/opencode/gomoku-online)
# 重新載入設定並啟用
systemctl --user daemon-reload
systemctl --user enable --now gomoku-online.service
```

## 注意事項 / Notes
- 使用於正式環境時，建議前方串接 Nginx 或其他 Reverse Proxy，並啟用 TLS 與 WebSocket Upgrade 支援。
- 務必將 `users.json` 加入 `.gitignore` 防止密碼外洩。

## License
MIT
