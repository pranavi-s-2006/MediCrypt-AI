import { useRef, useEffect, useState, useCallback } from 'react'
import { Camera, CameraOff, RefreshCw } from 'lucide-react'

/**
 * WebcamCapture
 * Props:
 *   onCapture(blob) — called with a JPEG Blob when user clicks capture
 *   captureLabel   — button label (default "Capture")
 *   autoCapture    — if true, call onCapture every `interval` ms automatically
 *   interval       — ms between auto-captures (default 1500)
 */
export default function WebcamCapture({
  onCapture,
  captureLabel = 'Capture Photo',
  autoCapture = false,
  interval = 1500,
}) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const timerRef   = useRef(null)

  const [active,  setActive]  = useState(false)
  const [error,   setError]   = useState(null)
  const [preview, setPreview] = useState(null)

  const stop = useCallback(() => {
    clearInterval(timerRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setActive(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setPreview(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
    } catch (e) {
      setError('Camera access denied. Please allow camera permission and retry.')
    }
  }, [])

  const capture = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      setPreview(URL.createObjectURL(blob))
      onCapture(blob)
    }, 'image/jpeg', 0.92)
  }, [onCapture])

  // Auto-capture mode: keep sending frames
  useEffect(() => {
    if (active && autoCapture) {
      timerRef.current = setInterval(capture, interval)
    }
    return () => clearInterval(timerRef.current)
  }, [active, autoCapture, capture, interval])

  useEffect(() => () => stop(), [stop])

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
        {active ? (
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        ) : preview ? (
          <img src={preview} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Camera size={32} />
            <p className="text-xs">Camera not started</p>
          </div>
        )}
        {active && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        {!active ? (
          <button onClick={start} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Camera size={14} /> Start Camera
          </button>
        ) : (
          <>
            {!autoCapture && (
              <button onClick={capture} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Camera size={14} /> {captureLabel}
              </button>
            )}
            <button onClick={stop} className="btn-secondary flex items-center gap-1.5 px-4">
              <CameraOff size={14} /> Stop
            </button>
          </>
        )}
        {preview && !active && (
          <button onClick={start} className="btn-secondary flex items-center gap-1.5 px-4">
            <RefreshCw size={13} /> Retake
          </button>
        )}
      </div>
    </div>
  )
}
