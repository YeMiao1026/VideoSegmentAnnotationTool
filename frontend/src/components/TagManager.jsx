import React, { useState } from 'react'

export default function TagManager({ tags, onTagsUpdate, disabled }) {
  const [input, setInput] = useState('')

  function addTag() {
    if (disabled) return
    const name = input.trim()
    if (!name) return
    if (tags.includes(name)) return setInput('')
    onTagsUpdate([...tags, name])
    setInput('')
  }

  function removeTag(name) {
    if (disabled) return
    onTagsUpdate(tags.filter(t => t !== name))
  }

  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="新增標籤" style={{ flex: 1 }} disabled={disabled} />
        <button className="btn btn-primary btn-small" onClick={addTag} title="新增標籤" disabled={disabled}>
          <span className="icon" aria-hidden>
            <svg className="icon-inline" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
          新增
        </button>
      </div>
      <div>
        {tags.map(t => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ flex: 1 }}>{t}</div>
            <button className="btn icon-btn" onClick={() => removeTag(t)} title={`刪除 ${t}`} disabled={disabled}>
              <svg className="icon-inline" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
