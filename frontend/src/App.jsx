import React, { useState, useRef, useEffect } from 'react'
import TagManager from './components/TagManager'
import VideoControl from './components/VideoControl'
import LabelingActions from './components/LabelingActions'
import AnnotationList from './components/AnnotationList'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

export default function App() {
  const [tags, setTags] = useState(['有趣', '廣告', '重要'])
  const [annotations, setAnnotations] = useState([])
  const [currentSegment, setCurrentSegment] = useState({ videoUrl: '', start: 0, end: 5 })

  // Load persisted data on mount
  useEffect(() => {
    async function load() {
      try {
        const [labelsResp, annsResp] = await Promise.all([
          axios.get('http://127.0.0.1:5000/api/labels'),
          axios.get('http://127.0.0.1:5000/api/annotations')
        ])
        if (labelsResp.data && Array.isArray(labelsResp.data.labels)) {
          setTags(labelsResp.data.labels)
        }
        if (annsResp.data && Array.isArray(annsResp.data.annotations)) {
          setAnnotations(annsResp.data.annotations)
        }
      } catch (e) {
        // ignore load errors (fallback to local state)
        console.warn('Failed to load persisted labels/annotations', e)
      }
    }
    load()
  }, [])

  function handleTagsUpdate(newTags) {
    setTags(newTags)
  }

  // persist tags when changed
  useEffect(() => {
    async function persistTags() {
      try {
        await axios.put('http://127.0.0.1:5000/api/labels', { labels: tags })
      } catch (e) {
        console.warn('Failed to persist tags', e)
      }
    }
    persistTags()
  }, [tags])

  function handleSegmentSubmit(segment) {
    setCurrentSegment(segment)
  }

  function handleLabelClick(label) {
    // 建立 annotation 物件
    const url = currentSegment.videoUrl
    if (!url) return alert('請先載入影片 URL')
    const videoIdMatch = url.match(/[?&]v=([^&]+)/)
    const videoId = videoIdMatch ? videoIdMatch[1] : url
    // If an annotation for the same clip exists, toggle the label in its labels array
    setAnnotations(prev => {
      const idx = prev.findIndex(a => a.video_url === url && a.start_time === Number(currentSegment.start) && a.end_time === Number(currentSegment.end))
      if (idx !== -1) {
        const existing = prev[idx]
        const labels = Array.isArray(existing.labels) ? [...existing.labels] : []
        const has = labels.includes(label)
        const newLabels = has ? labels.filter(l => l !== label) : [...labels, label]
        // if no labels left, remove the annotation
        if (newLabels.length === 0) {
          return prev.filter((_, i) => i !== idx)
        }
        const updated = { ...existing, labels: newLabels }
        return [updated, ...prev.filter((_, i) => i !== idx)]
      } else {
        const ann = {
          id: uuidv4(),
          video_id: videoId,
          video_url: url,
          start_time: Number(currentSegment.start),
          end_time: Number(currentSegment.end),
          labels: [label]
        }
          return [ann, ...prev]
      }
    })
  }

    // persist annotations when changed (debounced-ish)
    useEffect(() => {
      let mounted = true
      const toPersist = annotations.map(a => ({
        id: a.id,
        video_id: a.video_id,
        video_url: a.video_url,
        start_time: a.start_time,
        end_time: a.end_time,
        labels: Array.isArray(a.labels) ? a.labels : [],
        notes: a.notes || null,
        clip_filename: a.clip_filename || null
      }))
      async function persist() {
        try {
          await axios.put('http://127.0.0.1:5000/api/annotations', { annotations: toPersist })
        } catch (e) {
          if (mounted) console.warn('Failed to persist annotations', e)
        }
      }
      persist()
      return () => { mounted = false }
    }, [annotations])

  async function handleDownloadClip() {
    try {
      if (!currentSegment.videoUrl) {
        return alert('請先載入影片 URL')
      }
      const payload = {
        video_url: currentSegment.videoUrl,
        start_time: currentSegment.start,
        end_time: currentSegment.end
      }
      const resp = await axios.post('http://127.0.0.1:5000/api/download-clip', payload, { responseType: 'blob' })
      const blob = new Blob([resp.data], { type: 'video/mp4' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = `clip_${currentSegment.start}_${currentSegment.end}.mp4`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      // store clip blob and filename in annotations for export
      setAnnotations(prev => {
        const idx = prev.findIndex(x => x.video_url === currentSegment.videoUrl && (x.start_time ?? x.start_seconds ?? x.start) === Number(currentSegment.start) && (x.end_time ?? x.end_seconds ?? x.end) === Number(currentSegment.end))
        if (idx !== -1) {
          const updated = { ...prev[idx], clip_blob: blob, clip_filename: filename }
          return [updated, ...prev.filter((_, i) => i !== idx)]
        }
        // if no existing annotation, add a minimal one
        const videoIdMatch = currentSegment.videoUrl.match(/[?&]v=([^&]+)/)
        const videoId = videoIdMatch ? videoIdMatch[1] : currentSegment.videoUrl
        const ann = {
          id: uuidv4(),
          video_id: videoId,
          video_url: currentSegment.videoUrl,
          start_time: Number(currentSegment.start),
          end_time: Number(currentSegment.end),
          labels: [],
          clip_blob: blob,
          clip_filename: filename
        }
        return [ann, ...prev]
      })
    } catch (err) {
      // 更詳盡的錯誤訊息：後端回應內容或錯誤訊息
      try {
        if (err.response) {
          // 可能是文字或 JSON
          const data = err.response.data
          console.error('download error response', err.response.status, data)
          alert('下載失敗：' + (err.response.statusText || err.response.status) + '\n' + (typeof data === 'string' ? data : JSON.stringify(data)))
        } else {
          console.error(err)
          alert('下載失敗：' + (err.message || 'unknown error'))
        }
      } catch (e) {
        console.error('error handling error', e)
        alert('下載失敗，請查看控制台以取得細節')
      }
    }
  }

  return (
    <div className="app">
      <div className="panel">
        <div className="header">標籤管理</div>
        <TagManager tags={tags} onTagsUpdate={handleTagsUpdate} />
      </div>

      <div className="panel">
        <div className="header">影片控制與預覽</div>
        <VideoControl onSegmentSubmit={handleSegmentSubmit} currentSegment={currentSegment} onDownloadClip={handleDownloadClip} />
      </div>

      <div className="panel">
        <div className="header">已標註清單</div>
          <AnnotationList annotations={annotations} onDelete={(idx) => setAnnotations(prev => prev.filter((_, i) => i !== idx))} />
      </div>

      <div className="panel" style={{ gridColumn: '1 / -1' }}>
        <div className="header">標記按鈕</div>
        <LabelingActions tags={tags} onLabelClick={handleLabelClick} />
      </div>
    </div>
  )
}
