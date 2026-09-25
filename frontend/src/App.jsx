import { useState } from 'react'
import FileUpload from './components/FileUpload'
import ChatWindow from './components/ChatWindow'
import './App.css'

function getFileIcon(type, filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (type === 'pdf' || ext === 'pdf') return '📄'
  if (type === 'audio' || ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'].includes(ext)) return '🎵'
  if (type === 'video' || ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return '🎬'
  if (type === 'table' || ['csv', 'tsv'].includes(ext)) return '📊'
  if (type === 'markdown' || ['md', 'markdown'].includes(ext)) return '📑'
  return '📝'
}

export default function App() {
  const [files, setFiles] = useState([])

  function handleUploads(newFiles) {
    setFiles((prev) => {
      const existingNames = new Set(prev.map(f => f.filename || f.name))
      const added = (newFiles || []).map((f, i) => ({
        id: `${f.filename || f.name}-${Date.now()}-${i}`,
        filename: f.filename || f.name,
        file_type: f.file_type || 'document',
        chunks: f.chunks || 0,
        status: f.status || 'success',
        error: f.error || null,
      }))
      // Replace existing entries with same filename or prepend new ones
      const filtered = prev.filter(f => !newFiles.some(nf => (nf.filename || nf.name) === f.filename))
      return [...added, ...filtered]
    })
  }

  const totalChunks = files.reduce((sum, f) => sum + (f.chunks || 0), 0)

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <h1>Multimodal RAG Demo</h1>
          <p>Index documents, audio, and video & ask intelligent questions</p>
        </div>
        <div className="header-stats">
          <span className="stat-pill">📁 {files.length} Files</span>
          <span className="stat-pill">🧩 {totalChunks} Chunks</span>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <FileUpload onUpload={handleUploads} />

          <div className="file-list-section">
            <div className="file-list-header">
              <h3>Indexed Sources ({files.length})</h3>
              {files.length > 0 && (
                <button
                  className="clear-btn"
                  onClick={() => setFiles([])}
                  title="Clear file list from view"
                >
                  Clear View
                </button>
              )}
            </div>

            {files.length === 0 ? (
              <div className="empty-files">
                <span className="empty-icon">📂</span>
                <p>No files uploaded yet.</p>
                <span>Upload PDFs, notes, podcasts, or videos to get started.</span>
              </div>
            ) : (
              <ul className="file-list">
                {files.map((f) => (
                  <li key={f.id} className={`file-card ${f.status}`} title={f.filename}>
                    <div className="file-card-top">
                      <span className="file-icon">{getFileIcon(f.file_type, f.filename)}</span>
                      <span className="file-name">{f.filename}</span>
                    </div>
                    <div className="file-card-meta">
                      <span className="type-badge">{(f.file_type || 'doc').toUpperCase()}</span>
                      {f.status === 'success' ? (
                        <span className="chunks-badge">{f.chunks} chunks</span>
                      ) : (
                        <span className="error-badge" title={f.error || 'Failed'}>Error</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="chat-area">
          <ChatWindow filesCount={files.length} />
        </main>
      </div>
    </div>
  )
}

