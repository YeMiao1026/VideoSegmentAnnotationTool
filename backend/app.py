import os
import tempfile
import subprocess
import shutil
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from yt_dlp import YoutubeDL

app = Flask(__name__)
CORS(app)


@app.route('/ping', methods=['GET'])
def ping():
    # 健檢用路由：確認服務可達且回傳 JSON
    return jsonify({'status': 'ok'})

# Config: 影片暫存最大保存時間/機制視需求延伸

@app.route('/api/download-clip', methods=['POST'])
def download_clip():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing JSON body'}), 400

    video_url = data.get('video_url')
    start_time = data.get('start_time')
    end_time = data.get('end_time')

    if not video_url or start_time is None or end_time is None:
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        start_time = float(start_time)
        end_time = float(end_time)
        if start_time < 0 or end_time <= start_time:
            return jsonify({'error': 'Invalid time range'}), 400
    except Exception:
        return jsonify({'error': 'Invalid time format'}), 400

    temp_dir = tempfile.mkdtemp(prefix='vsat_')
    try:
        # 1) 使用 yt-dlp 下載影片成檔案 (best mp4-ish)
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4',
            'outtmpl': os.path.join(temp_dir, 'full.%(ext)s'),
            'quiet': True,
        }
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            # 找到實際的檔名
            # yt-dlp 會存成 full.<ext>
            # 在某些情況下，yt-dlp 會選 mp4 或 webm; 我們抓第一個匹配的檔案
        downloaded = None
        for fname in os.listdir(temp_dir):
            if fname.startswith('full.'):
                downloaded = os.path.join(temp_dir, fname)
                break
        if not downloaded or not os.path.exists(downloaded):
            return jsonify({'error': 'Failed to download video'}), 500

        # 2) 使用 ffmpeg 裁切影片到指定區間
        output_path = os.path.join(temp_dir, 'clip.mp4')
        # ffmpeg: -ss start -to end -i input -c copy 出錯機率較大，使用 re-encode 以確保兼容性
        cmd = [
            'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
            '-i', downloaded,
            '-ss', str(start_time),
            '-to', str(end_time),
            '-c', 'copy',
            output_path
        ]
        # 若 -c copy 失敗或產生空檔，後續可改為重新編碼策略
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            # 嘗試重新編碼的 fallback
            cmd_reencode = [
                'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
                '-i', downloaded,
                '-ss', str(start_time),
                '-to', str(end_time),
                '-c:v', 'libx264', '-c:a', 'aac',
                output_path
            ]
            proc2 = subprocess.run(cmd_reencode, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if proc2.returncode != 0 or not os.path.exists(output_path):
                return jsonify({'error': 'ffmpeg failed to cut clip'}), 500

        # 3) 回傳檔案
        return send_file(output_path, mimetype='video/mp4', as_attachment=True, download_name='clip.mp4')

    except Exception as e:
        return jsonify({'error': 'Failed to download or process video', 'detail': str(e)}), 500
    finally:
        # 清理暫存資料夾
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass

if __name__ == '__main__':
    # 以 debug 模式啟動（如需 production，請使用 gunicorn/uvicorn 等）
    app.run(host='0.0.0.0', port=5000, debug=True)
