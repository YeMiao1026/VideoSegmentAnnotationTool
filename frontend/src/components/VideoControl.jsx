import React, { useState, useRef, useEffect } from 'react'
import YouTube from 'react-youtube'

export default function VideoControl({ onSegmentSubmit, currentSegment, onDownloadClip }) {
  const [url, setUrl] = useState(currentSegment.videoUrl)
  const [start, setStart] = useState(currentSegment.start)
  const [end, setEnd] = useState(currentSegment.end)
  const [previewError, setPreviewError] = useState('')
  const playerRef = useRef(null)
  const intervalRef = useRef(null)
  const [loadedVideoId, setLoadedVideoId] = useState('')

  // initialize local inputs from currentSegment, but avoid overwriting while the user is typing
  useEffect(() => {
    const segUrl = currentSegment && currentSegment.videoUrl
    if (segUrl && segUrl !== url) {
      setUrl(segUrl)
    }
    if (typeof currentSegment?.start === 'number' && currentSegment.start !== start) setStart(currentSegment.start)
    if (typeof currentSegment?.end === 'number' && currentSegment.end !== end) setEnd(currentSegment.end)
  }, [currentSegment?.videoUrl, currentSegment?.start, currentSegment?.end])

  // parse mm:ss / hh:mm:ss or plain seconds into numeric seconds
  const parseTimeToSeconds = (v) => {
    if (v == null || v === '') return 0
    if (typeof v === 'number') return v
    const s = String(v).trim()
    if (/^\d+$/.test(s)) return Number(s)
    const parts = s.split(':').map(p => p.trim()).filter(Boolean)
    if (parts.length === 0) return NaN
    let seconds = 0
    for (let i = 0; i < parts.length; i++) {
      const part = parts[parts.length - 1 - i]
      const n = Number(part)
      if (Number.isNaN(n)) return NaN
      seconds += n * Math.pow(60, i)
    }
    return seconds
  }

  function loadSegment() {
    const cleaned = (url || '').trim()
    setUrl(cleaned)
    setPreviewError('')
    const vid = extractVideoId(cleaned)
    if (!vid) {
      setPreviewError('無法解析 YouTube ID，請確認連結格式')
      return
    }
    // parse start/end which may be seconds or mm:ss or h:mm:ss
    const parseTimeToSeconds = (v) => {
      if (v == null || v === '') return 0
      if (typeof v === 'number') return v
      const s = String(v).trim()
      // pure integer seconds
      if (/^\d+$/.test(s)) return Number(s)
      // colon separated, support ss, mm:ss, hh:mm:ss
      const parts = s.split(':').map(p => p.trim()).filter(Boolean)
      if (parts.length === 0) return NaN
      // reverse for easier multiply: seconds, minutes, hours
      let seconds = 0
      for (let i = 0; i < parts.length; i++) {
        const part = parts[parts.length - 1 - i]
        const n = Number(part)
        if (Number.isNaN(n)) return NaN
        seconds += n * Math.pow(60, i)
      }
      return seconds
    }

    const startSec = parseTimeToSeconds(start)
    const endSec = parseTimeToSeconds(end)
    if (Number.isNaN(startSec) || Number.isNaN(endSec)) {
      setPreviewError('開始或結束時間格式錯誤，請使用秒數或 mm:ss')
      return
    }
    if (endSec <= startSec) {
      setPreviewError('結束時間必須大於開始時間')
      return
    }
    setLoadedVideoId(vid)
    onSegmentSubmit({ videoUrl: cleaned, start: Number(startSec), end: Number(endSec) })
    // seek to start
    const player = playerRef.current
    // react-youtube 的 event.target 就有 seekTo 方法
    if (player && typeof player.seekTo === 'function') {
      try {
        player.seekTo(Number(startSec), true)
      } catch (e) {
        // ignore
      }
      // 播放預覽
      if (typeof player.playVideo === 'function') {
        try { player.playVideo() } catch (e) { /* ignore */ }
      }
    }
  }

  function startMonitor() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    if (!playerRef.current) return
    intervalRef.current = setInterval(() => {
      try {
        const t = playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getCurrentTime()
        if (typeof t === 'number' && t >= Number(end) - 0.05) {
          if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo()
          }
        }
      } catch (e) {
        // ignore
      }
    }, 200)
  }

  function handleReady(event) {
    // event.target is iframe API
    playerRef.current = event.target
    // 啟動監聽器
    startMonitor()
  }

  function handlePlayerError(e) {
    // e.data contains YouTube error code
    try {
      setPreviewError('YouTube 載入失敗 (code ' + (e?.data ?? 'unknown') + ')')
      console.error('[VideoControl] youtube error', e)
    } catch (err) { /* ignore */ }
  }

  // debug: log videoId / url when it changes to help diagnose preview issues
  // (debug logging moved below after videoId is declared)

  // 清理 interval（unmount 時）
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // 當 end 改變或 playerRef 初始化時，重啟監聽器以使用最新的 end 值
  useEffect(() => {
    if (!playerRef.current) return
    startMonitor()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [end])

  // 解析 YouTube ID 方便 react-youtube 使用
  function extractVideoId(link) {
    if (!link) return ''
    const s = (link || '').trim()
    // try parsing as URL
    try {
      const u = new URL(s)
      // e.g. https://www.youtube.com/watch?v=ID
      const v = u.searchParams.get('v')
      if (v) return v
      // e.g. https://youtu.be/ID or /embed/ID
      const p = u.pathname || ''
      const parts = p.split('/').filter(Boolean)
      if (u.hostname && u.hostname.includes('youtu')) {
        // last path segment may be id
        const last = parts[parts.length - 1]
        if (last) return last
      }
    } catch (e) {
      // not a full URL, continue to pattern matching
    }
    // fallback: common patterns
    const m = s.match(/[?&]v=([^&]+)/)
    if (m) return m[1]
    const short = s.match(/youtu\.be\/(.+)/)
    if (short) return short[1]
    // if looks like an id (11 chars of allowed chars) return it
    const idMatch = s.match(/^[A-Za-z0-9_-]{11}$/)
    if (idMatch) return s
    return ''
  }

  const opts = {
    height: '360',
    width: '640',
    playerVars: {
      autoplay: 0,
      // 設定 origin 避免 postMessage 的 target origin mismatch 問題
      origin: typeof window !== 'undefined' ? window.location.origin : ''
    }
  }

  const videoId = extractVideoId(url)
  // parsed seconds for UI state validation
  const parsedStart = parseTimeToSeconds(start)
  const parsedEnd = parseTimeToSeconds(end)
  const isSegmentValid = loadedVideoId && !Number.isNaN(parsedStart) && !Number.isNaN(parsedEnd) && (parsedEnd > parsedStart)

  // debug: log videoId / url when it changes to help diagnose preview issues
  useEffect(() => {
    try { console.debug('[VideoControl] videoId', videoId, 'url', url) } catch (e) { /* ignore */ }
  }, [videoId, url])

  return (
    <div>
      <div style={{ marginBottom: 8 }} className="controls">
        <input style={{ width: 360 }} placeholder="YouTube 連結" value={url} onChange={e => setUrl(e.target.value)} />
  <input style={{ width: 80 }} placeholder="start (s or m:ss)" value={start} onChange={e => setStart(e.target.value)} />
  <input style={{ width: 80 }} placeholder="end (s or m:ss)" value={end} onChange={e => setEnd(e.target.value)} />
        <button className="btn btn-small" onClick={loadSegment} title="載入並預覽片段">
          <svg className="icon-inline" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 21l-6-6M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          載入/預覽
        </button>
        <button className="btn btn-primary btn-small" disabled={!isSegmentValid} onClick={() => {
          // 如果目前輸入的 url 與已提交的 segment 不同，先執行載入，確保 currentSegment 更新
          if (!url) {
            setPreviewError('請先輸入 YouTube 連結並載入')
            return
          }
          if (!isSegmentValid) {
            setPreviewError('請先確認時間範圍有效且已載入預覽')
            return
          }
          if (currentSegment.videoUrl !== url) {
            loadSegment()
            // give a short moment for parent state to update
            setTimeout(() => {
              onDownloadClip()
            }, 200)
          } else {
            onDownloadClip()
          }
        }} title="下載此片段">
          <svg className="icon-inline" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12M5 10l7 7 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          下載此片段
        </button>
      </div>

      <div>
        {loadedVideoId ? (
          <div>
            {/* always show thumbnail as a fallback visual cue */}
            <div style={{ marginBottom: 8 }}>
              <img src={`https://img.youtube.com/vi/${loadedVideoId}/hqdefault.jpg`} alt="thumbnail" style={{ maxWidth: opts.width, width: '100%', maxHeight: opts.height }} />
            </div>
            {previewError ? <div className="small" style={{ color: 'crimson' }}>{previewError}</div> : null}
            <YouTube videoId={loadedVideoId} opts={opts} onReady={handleReady} onError={handlePlayerError} />
          </div>
        ) : (
          <div className="small">請輸入可解析的 YouTube 連結或影片 ID（輸入後按「載入/預覽」）</div>
        )}
      </div>

      <div style={{ marginTop: 8 }} className="small">播放區間: {start} — {end}</div>
    </div>
  )
}
