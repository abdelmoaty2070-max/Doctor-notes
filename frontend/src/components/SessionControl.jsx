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
  Upload,
  HeartPulse,
  Brain,
  Clock,
  FileAudio,
  ChevronLeft,
} from 'lucide-react'

const DIALECTS = [
  'المصرية',
  'السعودية',
  'الخليجية',
  'الإماراتية',
  'الشامية',
  'العراقية',
  'العربية الفصحى',
]

const PROCESSING_STEPS = [
  'جاري رفع وتنقية الموجات الصوتية...',
  'تحويل الحوار باللهجة المحلية إلى مصطلحات إكلينيكية...',
  'بناء تقرير SOAP واستخراج الأدوية والجرعات...',
]

function getSupportedRecordingFormat() {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: '', ext: 'webm', cleanMime: 'audio/webm' }
  }
  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', ext: 'webm', cleanMime: 'audio/webm' },
    { mimeType: 'audio/webm', ext: 'webm', cleanMime: 'audio/webm' },
    { mimeType: 'audio/mp4', ext: 'mp4', cleanMime: 'audio/mp4' },
    { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg', cleanMime: 'audio/ogg' },
  ]
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c
    } catch {
      // ignore
    }
  }
  return { mimeType: '', ext: 'webm', cleanMime: 'audio/webm' }
}

export default function SessionControl({ doctor, onProcessed }) {
  const [dialect, setDialect] = useState('المصرية')
  const [patientName, setPatientName] = useState('')
  const [status, setStatus] = useState('idle') // idle | recording | paused | processing
  const [seconds, setSeconds] = useState(0)
  const [bars, setBars] = useState(Array(28).fill(12))
  const [error, setError] = useState('')
  const [stepIdx, setStepIdx] = useState(0)
  const [recentSessions, setRecentSessions] = useState([])

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const lastAudioRef = useRef(null) // { blob, filename }
  const formatRef = useRef({ mimeType: '', ext: 'webm', cleanMime: 'audio/webm' })
  const timerRef = useRef(null)
  const stepTimerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const animFrameRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetch('/api/sessions')
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setRecentSessions(d.sessions || []))
      .catch(() => {})

    return () => {
      cleanupAudio()
      clearInterval(stepTimerRef.current)
    }
  }, [])

  const cleanupAudio = () => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
    }
  }

  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  const startVisualizer = (stream) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      const audioCtx = new AudioContextClass()
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
    } catch {
      // Visualizer is optional; recording still proceeds cleanly
    }
  }

  const handleStart = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      const fmt = getSupportedRecordingFormat()
      formatRef.current = fmt
      const recorderOptions = { audioBitsPerSecond: 32000 }
      if (fmt.mimeType) recorderOptions.mimeType = fmt.mimeType

      const mediaRecorder = new MediaRecorder(stream, recorderOptions)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(1000)
      setStatus('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      startVisualizer(stream)
    } catch {
      setError('تعذر الوصول إلى الميكروفون. يمكنك رفع ملف صوتي جاهز أو تجربة السيناريوهات الفورية أدناه.')
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

  const startStepProgress = () => {
    setStepIdx(0)
    clearInterval(stepTimerRef.current)
    stepTimerRef.current = setInterval(() => {
      setStepIdx((prev) => (prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev))
    }, 2200)
  }

  const submitAudioRequest = async ({ isDemo = false, demoScenario = 'cardiology', audioPayload = null }) => {
    setStatus('processing')
    setError('')
    startStepProgress()

    const formData = new FormData()
    formData.append('doctor_name', doctor.name)
    formData.append('specialty', doctor.specialty)
    formData.append('dialect', dialect)
    formData.append('demo_mode', String(isDemo))
    formData.append('demo_scenario', demoScenario)

    if (audioPayload?.blob) {
      formData.append('audio', audioPayload.blob, audioPayload.filename)
    }

    try {
      const res = await fetch('/api/sessions/process', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `تعذرت معالجة الجلسة (رمز ${res.status})`)
      }
      const data = await res.json()
      clearInterval(stepTimerRef.current)
      onProcessed({
        soap: data.soap,
        dialect,
        patientName: patientName.trim() || data.suggested_patient || 'مريض غير مسمى',
        duration: formatTime(seconds),
        mode: data.mode,
        model: data.model,
        processingSeconds: data.processing_seconds,
      })
    } catch (err) {
      clearInterval(stepTimerRef.current)
      setError(err.message || 'حدث خطأ أثناء الاتصال بالخادم')
      setStatus('idle')
    }
  }

  const handleFinishRecording = async () => {
    if (seconds < 2) {
      setError('التسجيل قصير جداً؛ يرجى التحدث لمدة ثانيتين على الأقل قبل الإنهاء.')
      return
    }

    let audioPayload = null
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = resolve
        try {
          mediaRecorderRef.current.requestData()
        } catch {
          // ignore
        }
        mediaRecorderRef.current.stop()
      })
      cleanupAudio()

      const fmt = formatRef.current
      const actualMime =
        (mediaRecorderRef.current.mimeType || fmt.cleanMime || 'audio/webm').split(';')[0]
      const blob = new Blob(chunksRef.current, { type: actualMime })
      audioPayload = { blob, filename: `session.${fmt.ext || 'webm'}` }
      lastAudioRef.current = audioPayload
    }

    if (!audioPayload || audioPayload.blob.size < 200) {
      setError('لم يتم التقاط صوت واضح من الميكروفون. يرجى التأكد من الميكروفون أو رفع ملف صوتي.')
      setStatus('idle')
      return
    }

    await submitAudioRequest({ isDemo: false, audioPayload })
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 4.4 * 1024 * 1024) {
      setError('حجم الملف كبير جداً (الحد الأقصى 4.4 ميجابايت للرفع السريع). يرجى اختيار مقطع أقصر.')
      return
    }
    const payload = { blob: file, filename: file.name || 'uploaded_audio.mp3' }
    lastAudioRef.current = payload
    await submitAudioRequest({ isDemo: false, audioPayload: payload })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Doctor Info & Dialect Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-lg border border-sky-100">
              {doctor.name.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">{doctor.name}</h2>
              <p className="text-sm text-slate-500">
                {doctor.specialty} • {doctor.clinic}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-emerald-100">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>محرك الذكاء الاصطناعي الطبي متصل</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
              <Globe2 className="w-4 h-4 text-sky-600" />
              <span>لهجة الحوار الطبي</span>
            </label>
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value)}
              disabled={status !== 'idle'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-sm font-medium disabled:opacity-60"
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
              <User className="w-4 h-4 text-sky-600" />
              <span>اسم المريض (اختياري)</span>
            </label>
            <input
              type="text"
              placeholder="مثال: محمود عبد الرحمن"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              disabled={status === 'processing'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-sm"
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
                  ? 'bg-gradient-to-t from-sky-600 to-cyan-400'
                  : status === 'paused'
                  ? 'bg-amber-400'
                  : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-6 text-sm text-rose-700 bg-rose-50 border border-rose-100 px-4 py-3.5 rounded-2xl space-y-2.5">
            <p className="font-medium">{error}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {lastAudioRef.current && (
                <button
                  onClick={() => submitAudioRequest({ isDemo: false, audioPayload: lastAudioRef.current })}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  إعادة محاولة معالجة نفس التسجيل
                </button>
              )}
              <button
                onClick={() => submitAudioRequest({ isDemo: true, demoScenario: 'cardiology' })}
                className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs transition cursor-pointer"
              >
                تشغيل نموذج العرض الفوري بدلاً من ذلك
              </button>
            </div>
          </div>
        )}

        {/* Hidden File Input for Audio Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Control Buttons */}
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-sky-400/25 animate-pulse-ring pointer-events-none" />
              <button
                onClick={handleStart}
                className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-xl shadow-sky-500/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                title="بدء التسجيل"
              >
                <Mic className="w-10 h-10" />
              </button>
            </div>

            <div>
              <p className="font-bold text-slate-800 text-lg">اضغط لبدء تسجيل الكشف الطبي</p>
              <p className="text-slate-500 text-sm mt-1">
                تحدث بشكل طبيعي مع المريض، وسيقوم النظام باستخراج التقرير الطبي والروشتة خلال ثوانٍ
              </p>
            </div>

            {/* Secondary Actions: Upload Audio File */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-700 font-semibold text-xs transition cursor-pointer border border-slate-200 hover:border-sky-200"
              >
                <Upload className="w-4 h-4 text-sky-600" />
                <span>رفع تسجيل صوتي جاهز (MP3 / M4A / WAV)</span>
              </button>
            </div>

            {/* Investor / Quick Demo Scenarios */}
            <div className="w-full pt-5 mt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400 mb-3 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span>نماذج محاكاة فورية للعرض التقديمي (بدون ميكروفون)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={() => submitAudioRequest({ isDemo: true, demoScenario: 'cardiology' })}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50/70 hover:bg-sky-100/80 text-sky-800 font-bold text-xs transition cursor-pointer border border-sky-200/70"
                >
                  <HeartPulse className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>حالة قلب وأوعية دموية (ذبحة صدرية)</span>
                </button>
                <button
                  type="button"
                  onClick={() => submitAudioRequest({ isDemo: true, demoScenario: 'migraine' })}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer border border-slate-200"
                >
                  <Brain className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>حالة باطنة وأعصاب (صداع نصفي)</span>
                </button>
              </div>
            </div>
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
                className="px-6 py-4 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold flex items-center gap-2.5 border border-sky-200 transition cursor-pointer"
              >
                <Play className="w-5 h-5" />
                <span>استئناف التسجيل</span>
              </button>
            )}

            <button
              onClick={handleFinishRecording}
              className="px-8 py-4 rounded-2xl bg-gradient-to-l from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold shadow-lg shadow-sky-500/25 flex items-center gap-2.5 transition cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>إنهاء الكشف وإصدار التقرير</span>
            </button>
          </div>
        )}

        {status === 'processing' && (
          <div className="py-6 flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-50 text-sky-600">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg">{PROCESSING_STEPS[stepIdx]}</p>
              <p className="text-xs text-slate-500 mt-1">
                يعمل بنموذج Gemini الطبي فائق السرعة — يستغرق عادةً 3 إلى 7 ثوانٍ
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {PROCESSING_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i <= stepIdx ? 'w-8 bg-sky-500' : 'w-3 bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Saved Sessions History */}
      {recentSessions.length > 0 && status === 'idle' && (
        <div className="mt-6 bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>آخر التقارير المحفوظة في العيادة</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              {recentSessions.length} جلسة
            </span>
          </div>
          <div className="space-y-2.5">
            {recentSessions.slice(0, 4).map((s) => (
              <button
                key={s.id}
                onClick={() =>
                  onProcessed({
                    soap: s.soap,
                    dialect: s.dialect,
                    patientName: s.patient_name || 'مريض غير مسمى',
                    duration: '--:--',
                    mode: 'saved',
                  })
                }
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/40 transition text-right cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-sky-100 text-slate-600 group-hover:text-sky-700 flex items-center justify-center shrink-0">
                    <FileAudio className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">
                      {s.patient_name || 'مريض غير مسمى'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {s.soap?.clinical_summary || 'تقرير زيارة طبية'}
                    </p>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-sky-600 shrink-0 mr-2" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
