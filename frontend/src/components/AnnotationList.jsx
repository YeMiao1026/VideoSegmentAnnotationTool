import React from 'react'
import JSZip from 'jszip'

export default function AnnotationList({ annotations, onDelete, disabled }) {
  function exportCSV() {
    const rows = ["video_url,start_time,end_time,labels,notes"]
    for (const a of annotations) {
      // join labels with semicolon to keep CSV simple
      const labels = (a.labels || []).join(';')
      // resolve start/end from known possible keys for backward compatibility
      const start = a.start_time ?? a.start_seconds ?? a.start ?? ''
      const end = a.end_time ?? a.end_seconds ?? a.end ?? ''
      // escape any quotes in notes/video_url by doubling them, and wrap in quotes
      const video = `"${(a.video_url || '').replace(/"/g, '""')}"`
      const notes = `"${(a.notes || '').replace(/"/g, '""')}"`
      rows.push(`${video},${start},${end},${labels},${notes}`)
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'annotations.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportWithClips() {
    // build CSV first
    const rows = ["video_url,start_time,end_time,labels,notes,clip_filename"]
    for (const a of annotations) {
      const labels = (a.labels || []).join(';')
      const start = a.start_time ?? a.start_seconds ?? a.start ?? ''
      const end = a.end_time ?? a.end_seconds ?? a.end ?? ''
      const video = `"${(a.video_url || '').replace(/"/g, '""')}"`
      const notes = `"${(a.notes || '').replace(/"/g, '""')}"`
      const clipName = a.clip_filename || ''
      rows.push(`${video},${start},${end},${labels},${notes},${clipName}`)
    }

    try {
      const zip = new JSZip()
      zip.file('annotations.csv', rows.join('\n'))

      // attach any clip blobs present in annotations
      let foundClip = false
      for (const a of annotations) {
        if (!a.clip_blob) continue
        let blobData = a.clip_blob
        // normalize non-Blob data into a Blob where reasonable
        try {
          if (!(blobData instanceof Blob)) {
            blobData = new Blob([blobData], { type: 'video/mp4' })
          }
        } catch (e) {
          console.warn('Could not convert clip_blob to Blob for annotation', a, e)
          continue
        }
        const clipName = a.clip_filename || `clip_${a.start_time || a.start || 'unknown'}_${a.end_time || a.end || 'unknown'}.mp4`
        zip.file(clipName, blobData)
        foundClip = true
      }

      if (!foundClip) {
        // if no clips were downloaded/stored, inform the user and still allow CSV
        const proceed = window.confirm('目前沒有已下載的片段要加入 ZIP。是否只匯出 CSV？ 按「取消」可先下載片段再回來匯出。')
        if (!proceed) return
        // user accepted — return a ZIP containing only the CSV
      }

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const el = document.createElement('a')
      el.href = url
      el.download = 'annotations_and_clips.zip'
      document.body.appendChild(el)
      el.click()
      el.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to create ZIP export', err)
      alert('匯出 ZIP 失敗，請查看 console 取得詳細錯誤訊息')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>標註列表</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-small" onClick={exportCSV} disabled={disabled}>匯出 CSV</button>
          <button className="btn btn-small" onClick={exportWithClips} disabled={disabled}>匯出 CSV + 片段 (ZIP)</button>
        </div>
      </div>
      <ol style={{ paddingLeft: 18, margin: 0 }}>
        {annotations.map((a, idx) => {
          const start = a.start_time ?? a.start_seconds ?? a.start ?? ''
          const end = a.end_time ?? a.end_seconds ?? a.end ?? ''
          const title = a.clip_filename || a.video_id || `片段 ${idx + 1}`
          return (
            <li key={a.id || `${idx}-${start}-${end}`} style={{ padding: '10px 0', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div><strong>{idx + 1}. {title}</strong></div>
                <div style={{ marginTop: 4 }}>{start} — {end}</div>
                <div style={{ marginTop: 6 }}>
                  {(a.labels || []).map(l => (
                    <span key={l} className="tag-btn" style={{ marginRight: 6 }}>{l}</span>
                  ))}
                </div>
              </div>
              <div>
                <button className="btn icon-btn" onClick={() => !disabled && onDelete(idx)} title="刪除標註" disabled={disabled}>
                  <svg className="icon-inline" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
