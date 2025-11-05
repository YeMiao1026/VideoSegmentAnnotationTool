
# Video Segment Annotation Tool

一個簡單的工具，用於載入 YouTube 影片、標記片段、管理標籤、匯出 CSV，並支援由後端裁切並下載影片片段。

本專案包含：
- 前端：React + Vite
- 後端：Flask（使用 yt-dlp + ffmpeg）
- 測試：Puppeteer（E2E 範例）

此 README 提供給非技術或新手使用者的一鍵啟動與快速安裝指引（Windows PowerShell 範例）。

## 系統需求（重要）
- Windows / macOS / Linux
- Python 3.8+（後端）
- Node.js 16+（前端）
- ffmpeg（系統層需安裝並放到 PATH，或使用 Docker image 內建）
- 可選：Docker Desktop（若要用 docker-compose 一鍵啟動）

## 快速方式 A — 給非技術使用者（建議）
專案根目錄已提供 `start-local.ps1`（Windows PowerShell），可自動為你準備環境並啟動後端與前端（開發模式）。

步驟：

1. 先安裝系統需求：Python、Node.js、ffmpeg（並確認三者可從命令列執行，例如執行 `python --version`、`node --version`、`ffmpeg -version`）。
2. 開啟 PowerShell（視為管理者或一般使用者皆可），cd 到此專案根目錄，執行：

```powershell
./start-local.ps1
```

此腳本會：
- 在 `backend/` 建立 `.venv`（若不存在）並安裝 Python 相依套件。
- 在 `frontend/` 安裝 npm 相依並啟動 Vite 開發伺服器。
- 各服務會在獨立視窗中啟動並顯示日誌，方便非技術同仁觀察。

啟動成功後，開啟瀏覽器到 Vite 顯示的本機網址（通常是 `http://localhost:5173` 或 Vite 所顯示的 port）。

## 快速方式 B — Docker（推薦給想一鍵部署或跨平台的情境）
若電腦已安裝 Docker Desktop，使用 docker-compose 可以在任何支援 Docker 的系統上快速啟動前後端（後端 image 已包含 ffmpeg）。

步驟：

1. 啟動 Docker Desktop（Windows 使用者請先啟動 Docker Desktop）。
2. 在專案根目錄執行：

```powershell
docker-compose up -d --build

# 檢查狀態
docker-compose ps

# 查看日誌（即時）
docker-compose logs -f

# 停止並移除容器
docker-compose down
```

預設對外端口：
- 前端（nginx）對應宿主機 80
- 後端 對應宿主機 5000

備註：若遇到 Windows 上的 pipe 錯誤（例如 `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.`），請確認 Docker Desktop 已啟動並運行。

## 手動安裝（開發者／進階使用者）

1) 後端（在 PowerShell 中）：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# 啟動（開發模式）
$env:FLASK_APP='app.py'; $env:FLASK_ENV='development'; python app.py
```

2) 前端（在另一個 PowerShell 視窗）：

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
```

若你在安裝相依時遇到 peer conflict，`--legacy-peer-deps` 可解決多數舊版相依問題（我們已在 package.json 中調整過 plugin 版本以減少衝突）。

## 匯出 / 下載功能
- 前端支援匯出 CSV（標註清單）。
- 若你在前端執行「下載片段」功能，前端會把該片段的 Blob 暫存在記憶體，並可透過「匯出 CSV + 片段 (ZIP)」把 CSV 與已下載的片段一起匯出（以 ZIP 下載）。

提醒：前端的 clip Blob 只會保存在當前瀏覽器頁面 session，重新整理或關閉頁面會遺失；若需要長期保存或讓其他使用者也能下載片段，請使用 Docker 部署並使用 server-side 匯出流程（可由我協助實作）。

## E2E 測試（Puppeteer）
測試腳本位於 `frontend/test/e2e_puppeteer.js`，執行前請先確保後端與前端都已啟動：

```powershell
# 在 frontend 資料夾執行（headful，會啟動可視瀏覽器）
$env:HEADLESS='false'; node .\test\e2e_puppeteer.js

# 或 headless：
$env:HEADLESS='true'; node .\test\e2e_puppeteer.js
```

測試會把執行日誌輸出成 `puppeteer_log.txt`（包含 page console 與 network events），方便 Debug。

## 常見問題（快速排查）
- 如果前端啟動失敗或顯示 `jszip` 找不到，請在 `frontend` 執行 `npm install`。
- 如果後端回傳 500 或 ffmpeg 錯誤：請確認系統上已安裝 ffmpeg（或使用 Docker，image 內已包含 ffmpeg）。
- 如果 docker-compose 無法連到 docker daemon：請啟動 Docker Desktop。

## 我可以幫你做（選項）
- 幫你把後端做成 server-side export：將下載的片段保存在後端並由後端產生 ZIP，適合需長期保存或大量匯出的情境。
- 在 README 中加入更多步驟截圖或一鍵安裝指引（例如 PowerShell 範例檔）。

若要我執行其中一項（例如替你在本機執行 docker-compose 並回報 logs，或新增 server-side export endpoint），請回覆你要我做的項目，我會繼續操作並回報結果。


如果需要，我可以：
- 幫你在 CI 中加入 Docker build 與測試流程
- 新增 nginx proxy 設定，讓前端以 `/api` 路徑 proxied 到後端（減少 CORS 問題）
- 或替你在伺服器上執行一次 `docker-compose up --build` 並回報建置/啟動結果
