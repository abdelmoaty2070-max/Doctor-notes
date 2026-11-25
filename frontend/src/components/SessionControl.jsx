import { useState, useRef, useEffect } from 'react'
import {
  Mic,
  Pause,
  Play,
  CheckCircle2,
  Sparkles,
  User,
  Globe2,
  Loader2,
  Radio,
} from 'lucide-react'

const DIALECTS = [
  'المصرية',
  'الخليجية',
  'السعودية',
  'الإماراتية',
  'العراقية',
  'الشامية',
  'العربية الفصحى',
]

export default function SessionControl({ doctor, onProcessed }) {
  const [dialect, setDialect] = useState('المصرية')
  const [patientName, setPatientName] = useState('')
  const [status, setStatus] = useState('idle') // idle | recording | paused | processing
  const [seconds, setSeconds] = useState(0)
  const [bars, setBars] = useState(Array(28).fill(12))
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const animFrameRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    return () => {
      cleanupAudio()
    }
  }, [])

  const cleanupAudio = () => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
    }
  }

  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  const startVisualizer = (stream) => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = audioCtx
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const update = () => {
      analyser.getByteFrequencyData(dataArray)
      const nextBars = Array.from({ length: 28 }, (_, i) => {
        const val = dataArray[i % dataArray.length] || 0
        return Math.max(10, Math.min(100, Math.round((val / 255) * 100)))
      })
      setBars(nextBars)
      animFrameRef.current = requestAnimationFrame(update)
    }
    update()
  }

  const handleStart = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 24000,
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(250)
      setStatus('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      startVisualizer(stream)
    } catch {
      setError('تعذر الوصول إلى الميكروفون. يمكنك استخدام "تجربة فورية (Demo)" أدناه.')
    }
  }

  const handlePause = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.pause()
      clearInterval(timerRef.current)
      cancelAnimationFrame(animFrameRef.current)
      setBars(Array(28).fill(14))
      setStatus('paused')
    }
  }

  const handleResume = () => {
    if (mediaRecorderRef.current && status === 'paused') {
      mediaRecorderRef.current.resume()
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      if (streamRef.current) startVisualizer(streamRef.current)
      setStatus('recording')
    }
  }

  const processSession = async (isDemo = false) => {
    setStatus('processing')
    setError('')

    let audioBlob = null
    if (!isDemo && mediaRecorderRef.current) {
      await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = resolve
        mediaRecorderRef.current.stop()
      })
      cleanupAudio()
      audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
    }

    const formData = new FormData()
    formData.append('doctor_name', doctor.name)
    formData.append('specialty', doctor.specialty)
    formData.append('dialect', dialect)
    formData.append('demo_mode', String(isDemo))
    if (audioBlob) {
      formData.append('audio', audioBlob, 'session.webm')
    }

    try {
      const res = await fetch('/api/sessions/process', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `فشلت معالجة الجلسة (${res.status})`)
      }
      const data = await res.json()
      onProcessed({
        soap: data.soap,
        dialect,
        patientName: patientName.trim() || 'مريض غير مسمى',
        duration: formatTime(seconds),
        mode: data.mode,
      })
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء المعالجة')
      setStatus('idle')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Doctor Info & Dialect Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-lg border border-teal-100">
              {doctor.name.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">{doctor.name}</h2>
              <p className="text-sm text-slate-500">{doctor.specialty} • {doctor.clinic}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-emerald-100">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>النظام جاهز للاستماع</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
              <Globe2 className="w-4 h-4 text-teal-600" />
              <span>لهجة المريض السائدة</span>
            </label>
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value)}
              disabled={status !== 'idle'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-500 outline-none text-sm font-medium disabled:opacity-60"
            >
              {DIALECTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
              <User className="w-4 h-4 text-teal-600" />
              <span>اسم المريض (اختياري)</span>
            </label>
            <input
              type="text"
              placeholder="مثال: أحمد محمد"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              disabled={status === 'processing'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-500 outline-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* Main Recording Studio */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-8 md:p-10 text-center">
        {/* Timer */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-700 font-mono text-sm font-bold mb-6">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              status === 'recording'
                ? 'bg-rose-500 animate-pulse'
                : status === 'paused'
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`}
          />
          <span>{formatTime(seconds)}</span>
        </div>

        {/* Live Waveform Visualizer */}
        <div className="h-24 flex items-center justify-center gap-1.5 mb-8 px-4">
          {bars.map((height, idx) => (
            <div
              key={idx}
              style={{ height: `${height}%` }}
              className={`w-1.5 rounded-full transition-all duration-100 ${
                status === 'recording'
                  ? 'bg-gradient-to-t from-teal-600 to-emerald-400'
                  : status === 'paused'
                  ? 'bg-amber-400'
                  : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-6 text-sm text-rose-700 bg-rose-50 border border-rose-100 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Control Buttons */}
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <button
                onClick={handleStart}
                className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-xl shadow-teal-600/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                title="بدء التسجيل"
              >
                <Mic className="w-10 h-10" />
              </button>
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg">اضغط لبدء تسجيل الجلسة</p>
              <p className="text-slate-500 text-sm mt-1">
                تحدث بشكل طبيعي مع المريض، وسيتولى النظام الباقي
              </p>
            </div>

            <button
              onClick={() => processSession(true)}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 font-semibold text-sm transition cursor-pointer border border-slate-200 hover:border-teal-200"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>تجربة فورية لنتائج الذكاء الاصطناعي (Demo)</span>
            </button>
          </div>
        )}

        {(status === 'recording' || status === 'paused') && (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {status === 'recording' ? (
              <button
                onClick={handlePause}
                className="px-6 py-4 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold flex items-center gap-2.5 border border-amber-200 transition cursor-pointer"
              >
                <Pause className="w-5 h-5" />
                <span>إيقاف مؤقت</span>
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="px-6 py-4 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold flex items-center gap-2.5 border border-teal-200 transition cursor-pointer"
              >
                <Play className="w-5 h-5" />
                <span>استئناف التسجيل</span>
              </button>
            )}

            <button
              onClick={() => processSession(false)}
              className="px-8 py-4 rounded-2xl bg-gradient-to-l from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold shadow-lg shadow-teal-600/25 flex items-center gap-2.5 transition cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>إنهاء الجلسة والمعالجة</span>
            </button>
          </div>
        )}

        {status === 'processing' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
            <p className="font-bold text-slate-800 text-lg">
              جاري تحليل الحوار واستخراج تقرير SOAP...
            </p>
            <p className="text-sm text-slate-500">
              يتم تحويل اللهجة المحلية إلى مصطلحات طبية دقيقة
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
