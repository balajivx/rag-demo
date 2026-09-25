import { useState, useRef } from 'react'
import './FileUpload.css'

const ACCEPTED_EXTENSIONS = ".pdf,.txt,.md,.csv,.tsv,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.mp3,.wav,.m4a,.ogg,.aac,.flac,.mp4,.webm,.mov"

export default function FileUpload({ onUpload }) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus]     = useState(null)  // { type: 'ok'|'err'|'info', msg }
  const [loading, setLoading]   = useState(false)
  const [fileCount, setFileCount] = useState(0)
  const inputRef = useRef()

  async function uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    setLoading(true)
    setFileCount(files.length)
    setStatus({ type: 'info', msg: `[PROCESSING] Ingesting & embedding ${files.length} file(s)...` })

    const form = new FormData()
    files.forEach((f) => {
      form.append('files', f)
    })

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/upload`, {
        method: 'POST',
        body: form,
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { data = { detail: text } }

      if (!res.ok) throw new Error(data.detail || 'Upload failed')

      const successCount = (data.files || []).filter(f => f.status === 'success').length
      setStatus({
        type: 'ok',
        msg: `[SYNCHRONIZED] ${data.total_chunks || data.chunks || 0} vectors created from ${successCount} file(s)`,
      })
      if (data.files && data.files.length > 0) {
        onUpload(data.files)
      } else {
        onUpload([{ filename: files[0].name, chunks: data.chunks || 0, status: 'success', file_type: 'document' }])
      }
    } catch (e) {
      setStatus({ type: 'err', msg: `[ERROR] ${e.message}` })
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className="upload-section">
      <div className="section-title-bar">
        <span className="terminal-prompt">//</span>
        <h2>DATA INGESTION</h2>
        <span className="tech-badge">MULTIMODAL</span>
      </div>

      <div
        className={`drop-zone${dragging ? ' dragging' : ''}${loading ? ' loading' : ''}`}
        onClick={() => !loading && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="drop-zone-glow"></div>
        <div className="drop-icon-container">
          <span className="icon">{loading ? '⚡' : '📥'}</span>
        </div>
        <p className="main-text">
          {loading
            ? `Transcribing & Vectorizing (${fileCount} files)...`
            : 'Drop files to vectorize or browse'}
        </p>
        <div className="format-tags">
          <span className="tag-pdf">📄 PDF</span>
          <span className="tag-img">🖼️ IMG</span>
          <span className="tag-aud">🎵 AUD</span>
          <span className="tag-vid">🎬 VID</span>
          <span className="tag-txt">📊 CSV/TXT</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          hidden
          onChange={(e) => uploadFiles(e.target.files)}
        />
      </div>

      {status && (
        <div className={`status ${status.type}`}>
          <span className="status-dot"></span>
          <span>{status.msg}</span>
        </div>
      )}
    </div>
  )
}


