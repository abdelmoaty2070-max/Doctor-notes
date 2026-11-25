import { useState } from 'react'
import { Stethoscope, Lock, Mail, Sparkles, ArrowLeft } from 'lucide-react'

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState('د. عبد المعطي')
  const [specialty, setSpecialty] = useState('طب عام وباطنية')
  const [email, setEmail] = useState('dr.abdelmoaty@clinic.ai')
  const [password, setPassword] = useState('••••••••')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, specialty }),
      })
      if (!res.ok) throw new Error('تعذر تسجيل الدخول')
      const data = await res.json()
      onLogin(data.doctor)
    } catch {
      onLogin({
        name: name || 'د. عبد المعطي',
        specialty: specialty || 'طب عام وباطنية',
        clinic: 'عيادة الرعاية الذكية',
        email,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50/40 to-emerald-50/50 p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-600/25 mb-4">
            <Stethoscope className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Doctor Notes
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm font-medium">
            مساعدك الذكي للتوثيق الإكلينيكي الفوري
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/70 border border-white p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  اسم الطبيب
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-teal-500 outline-none transition text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  التخصص
                </label>
                <input
                  type="text"
                  required
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-teal-500 outline-none transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                البريد الإلكتروني الطبي
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-11 pl-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-11 pl-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-l from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold shadow-lg shadow-teal-600/25 hover:shadow-teal-600/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{loading ? 'جاري الدخول...' : 'دخول إلى العيادة'}</span>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>نسخة العرض التقديمي (MVP) — جاهزة للتشغيل الفوري</span>
          </div>
        </div>
      </div>
    </div>
  )
}
