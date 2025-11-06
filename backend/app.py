import json
import os
import tempfile
import subprocess
import shutil
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from yt_dlp import YoutubeDL

# SQLAlchemy for persistence
from sqlalchemy import create_engine, Column, String, Float, Text, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

app = Flask(__name__)
CORS(app)

# --- Simple SQLite setup ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'db.sqlite')
engine = create_engine(f'sqlite:///{DB_PATH}', connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Label(Base):
    __tablename__ = 'labels'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)


class Annotation(Base):
    __tablename__ = 'annotations'
    id = Column(String, primary_key=True, index=True)
    video_id = Column(String, nullable=True)
    video_url = Column(String, nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    labels = Column(Text, nullable=True)  # JSON-encoded list
    notes = Column(Text, nullable=True)
    clip_filename = Column(String, nullable=True)


def init_db():
    Base.metadata.create_all(bind=engine)


init_db()


@app.route('/ping', methods=['GET'])
def ping():
    # 健檢用路由：確認服務可達且回傳 JSON
    return jsonify({'status': 'ok'})


@app.route('/api/labels', methods=['GET'])
def get_labels():
    db = SessionLocal()
    try:
        rows = db.query(Label).order_by(Label.id.desc()).all()
        labels = [r.name for r in rows]
        return jsonify({'labels': labels})
    finally:
        db.close()


@app.route('/api/labels', methods=['PUT'])
def put_labels():
    data = request.get_json() or {}
    labels = data.get('labels')
    if labels is None or not isinstance(labels, list):
        return jsonify({'error': 'labels must be a list'}), 400
    db = SessionLocal()
    try:
        # Simple replace semantics: delete all, re-insert
        db.query(Label).delete()
        for name in labels:
            name = str(name).strip()
            if not name:
                continue
            db.add(Label(name=name))
        db.commit()
        return jsonify({'status': 'ok', 'labels': labels})
    finally:
        db.close()


@app.route('/api/annotations', methods=['GET'])
def get_annotations():
    db = SessionLocal()
    try:
        rows = db.query(Annotation).order_by(Annotation.start_time.desc()).all()
        out = []
        for r in rows:
            try:
                labels = json.loads(r.labels) if r.labels else []
            except Exception:
                labels = []
            out.append({
                'id': r.id,
                'video_id': r.video_id,
                'video_url': r.video_url,
                'start_time': r.start_time,
                'end_time': r.end_time,
                'labels': labels,
                'notes': r.notes,
                'clip_filename': r.clip_filename,
            })
        return jsonify({'annotations': out})
    finally:
        db.close()


@app.route('/api/annotations', methods=['PUT'])
def put_annotations():
    data = request.get_json() or {}
    anns = data.get('annotations')
    if anns is None or not isinstance(anns, list):
        return jsonify({'error': 'annotations must be a list'}), 400
    db = SessionLocal()
    try:
        # Replace semantics: delete all and insert provided list
        db.query(Annotation).delete()
        for a in anns:
            try:
                aid = a.get('id') or a.get('uuid') or None
                if not aid:
                    # generate a simple id from video/url/start/end
                    aid = f"{a.get('video_url','')}_{a.get('start_time')}_{a.get('end_time')}"
                labels = a.get('labels') or []
                db.add(Annotation(
                    id=str(aid),
                    video_id=a.get('video_id'),
                    video_url=a.get('video_url') or a.get('videoUrl') or '',
                    start_time=float(a.get('start_time') or a.get('start') or 0),
                    end_time=float(a.get('end_time') or a.get('end') or 0),
                    labels=json.dumps(labels),
                    notes=a.get('notes'),
                    clip_filename=a.get('clip_filename')
                ))
            except Exception:
                continue
        db.commit()
        return jsonify({'status': 'ok', 'count': len(anns)})
    finally:
        db.close()

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
