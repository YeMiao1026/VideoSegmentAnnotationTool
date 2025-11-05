import React from 'react'

export default function LabelingActions({ tags, onLabelClick }) {
  return (
    <div>
      {tags.map((t, idx) => (
        <button key={t} className="tag-btn" onClick={() => onLabelClick(t)}>{idx+1}. {t}</button>
      ))}
    </div>
  )
}
