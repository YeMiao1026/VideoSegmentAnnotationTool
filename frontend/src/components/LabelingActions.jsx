import React from 'react'

export default function LabelingActions({ tags, onLabelClick, disabled }) {
  return (
    <div>
      {tags.map((t, idx) => (
        <button key={t} className="tag-btn" onClick={() => !disabled && onLabelClick(t)} disabled={disabled}>
          {idx+1}. {t}
        </button>
      ))}
    </div>
  )
}
