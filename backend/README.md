# Backend (Flask) - Video Clip Download API

此後端提供一個簡單的 API 端點，用於接收 YouTube 影片 URL 與時間區間，下載影片並裁切後回傳剪輯檔案。

前提環境
- Python 3.8+
- 系統安裝 ffmpeg，且 ffmpeg 可從命令列執行（在 PATH 中）。

Windows 安裝 ffmpeg (簡短指引)
1. 下載 ffmpeg 靜態編譯版本 (https://www.gyan.dev/ffmpeg/builds/ 或 https://ffmpeg.org/download.html)
2. 將 ffmpeg 可執行檔所在資料夾加入系統 PATH
3. 在 PowerShell 測試：

ffmpeg -version

安裝 Python 相依套件

# 建議使用虛擬環境
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

啟動後端

python app.py

API
POST /api/download-clip

Request JSON:
{
  "video_url": "https://www.youtube.com/watch?v=...",
  "start_time": 30.5,
  "end_time": 45.0
}

Response:
- 200 OK: 回傳裁切後的 MP4 檔案（Content-Type: video/mp4）
- 400 / 500: JSON 錯誤訊息

注意事項
- 專案範例將下載完整影片再裁切，實務上可採用更優化的串流或分段下載策略以節省磁碟與網路。
- 若需要在生產環境長時間運作，建議改用 queue 與工作程序（Celery / RQ），並加入更嚴謹的資源管理與權限控管。