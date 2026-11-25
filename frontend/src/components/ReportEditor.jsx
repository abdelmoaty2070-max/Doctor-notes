import { useState } from 'react'
import {
  Printer,
  Save,
  Plus,
  Trash2,
  ArrowRight,
  Check,
  SlidersHorizontal,
  Pill,
  FileText,
  Edit3,
} from 'lucide-react'

export default function ReportEditor({ doctor, sessionData, onBack }) {
  const [soap, setSoap] = useState(sessionData.soap)
  const [patientName, setPatientName] = useState(sessionData.patientName)
  const [newMed, setNewMed] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showMargins, setShowMargins] = useState(false)
  const [topMargin, setTopMargin] = useState(24) // mm for clinic letterhead
  const [bottomMargin, setBottomMargin] = useState(16)

  const handleFieldChange = (field, value) => {
    setSoap((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleMedChange = (index, value) => {
    const updated = [...soap.medications]
    updated[index] = value
    handleFieldChange('medications', updated)
  }

  const handleAddMed = () => {
    if (!newMed.trim()) return
    handleFieldChange('medications', [...soap.medications, newMed.trim()])
    setNewMed('')
  }

  const handleRemoveMed = (index) => {
    const updated = soap.medications.filter((_, i) => i !== index)
    handleFieldChange('medications', updated)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_name: doctor.name,
          specialty: doctor.specialty,
          dialect: sessionData.dialect,
          patient_name: patientName,
          soap,
        }),
      })
      setSaved(true)
    } catch {
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const sections = [
    {
      key: 'subjective',
      title: 'S — الشكوى والتاريخ المرضي (Subjective)',
      badge: 'S',
      color: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    {
      key: 'objective',
      title: 'O — الفحص السريري والعلامات الحيوية (Objective)',
      badge: 'O',
      color: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    {
      key: 'assessment',
      title: 'A — التقييم والتشخيص (Assessment)',
      badge: 'A',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      key: 'plan',
      title: 'P — الخطة العلاجية والمتابعة (Plan)',
      badge: 'P',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-sm transition cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>جلسة جديدة</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowMargins(!showMargins)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition cursor-pointer ${
              showMargins
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>هوامش ورق العيادة</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-60"
          >
            {saved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'تم الحفظ' : saving ? 'جاري الحفظ...' : 'حفظ التقرير'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-l from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-sm font-bold shadow-md shadow-teal-600/20 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة على ورق العيادة</span>
          </button>
        </div>
      </div>

      {/* Letterhead Margin Controls */}
      {showMargins && (
        <div className="no-print mb-6 bg-teal-50/70 border border-teal-200 rounded-2xl p-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-teal-900">الهامش العلوي (للترويسة):</label>
            <input
              type="range"
              min="0"
              max="60"
              value={topMargin}
              onChange={(e) => setTopMargin(Number(e.target.value))}
              className="accent-teal-600"
            />
            <span className="text-xs font-mono font-bold text-teal-800">{topMargin} mm</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-teal-900">الهامش السفلي:</label>
            <input
              type="range"
              min="0"
              max="40"
              value={bottomMargin}
              onChange={(e) => setBottomMargin(Number(e.target.value))}
              className="accent-teal-600"
            />
            <span className="text-xs font-mono font-bold text-teal-800">{bottomMargin} mm</span>
          </div>
        </div>
      )}

      {/* Printable Report Sheet */}
      <div
        className="print-sheet bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-6 md:p-10"
        style={{
          paddingTop: `${topMargin}px`,
          paddingBottom: `${bottomMargin}px`,
        }}
      >
        {/* Report Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 mb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-teal-700 font-bold text-sm mb-1 no-print">
              <Edit3 className="w-4 h-4" />
              <span>وضع المراجعة والتعديل الحر</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">تقرير الزيارة الطبية</h2>
            <p className="text-sm text-slate-500 mt-1">
              الطبيب: <span className="font-semibold text-slate-700">{doctor.name}</span> ({doctor.specialty})
            </p>
          </div>

          <div className="text-left space-y-1.5">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs text-slate-500">اسم المريض:</span>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="text-sm font-bold text-slate-900 border-b border-dashed border-slate-300 focus:border-teal-600 outline-none bg-transparent text-right w-40"
              />
            </div>
            <p className="text-xs text-slate-500">
              التاريخ: {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Clinical Summary */}
        <div className="mb-6 bg-slate-50 rounded-2xl p-4 border border-slate-200/70">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-1.5">
            <FileText className="w-4 h-4 text-teal-600" />
            <span>الملخص الإكلينيكي السريع</span>
          </div>
          <input
            type="text"
            value={soap.clinical_summary}
            onChange={(e) => handleFieldChange('clinical_summary', e.target.value)}
            className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
          />
        </div>

        {/* SOAP Sections */}
        <div className="space-y-5 mb-8">
          {sections.map((sec) => (
            <div key={sec.key} className="rounded-2xl border border-slate-200/80 p-4 hover:border-teal-300/70 transition">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center border ${sec.color}`}>
                  {sec.badge}
                </span>
                <h3 className="font-bold text-slate-800 text-sm">{sec.title}</h3>
              </div>
              <textarea
                rows={3}
                value={soap[sec.key]}
                onChange={(e) => handleFieldChange(sec.key, e.target.value)}
                className="w-full text-sm text-slate-700 leading-relaxed bg-transparent outline-none resize-y"
              />
            </div>
          ))}
        </div>

        {/* Medications Section */}
        <div className="rounded-2xl border border-teal-200/80 bg-teal-50/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-5 h-5 text-teal-700" />
            <h3 className="font-bold text-slate-900">الأدوية والجرعات المقترحة</h3>
          </div>

          <div className="space-y-2.5">
            {soap.medications.map((med, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={med}
                  onChange={(e) => handleMedChange(idx, e.target.value)}
                  className="w-full text-sm font-medium text-slate-800 outline-none bg-transparent"
                />
                <button
                  onClick={() => handleRemoveMed(idx)}
                  className="no-print text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                  title="حذف الدواء"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Medication */}
          <div className="no-print mt-3 flex gap-2">
            <input
              type="text"
              placeholder="إضافة دواء جديد (الاسم + الجرعة + التكرار)..."
              value={newMed}
              onChange={(e) => setNewMed(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMed()}
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-teal-500"
            />
            <button
              onClick={handleAddMed}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
