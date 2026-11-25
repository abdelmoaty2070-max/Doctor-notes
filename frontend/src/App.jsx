import { useState } from 'react'
import { Stethoscope, LogOut } from 'lucide-react'
import LoginScreen from './components/LoginScreen'
import SessionControl from './components/SessionControl'
import ReportEditor from './components/ReportEditor'

export default function App() {
  const [doctor, setDoctor] = useState(null)
  const [sessionData, setSessionData] = useState(null)

  if (!doctor) {
    return <LoginScreen onLogin={setDoctor} />
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar (Hidden in Print) */}
      <header className="no-print bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                Doctor Notes
              </span>
              <span className="mr-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                MVP
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setSessionData(null)
              setDoctor(null)
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {!sessionData ? (
          <SessionControl doctor={doctor} onProcessed={setSessionData} />
        ) : (
          <ReportEditor
            doctor={doctor}
            sessionData={sessionData}
            onBack={() => setSessionData(null)}
          />
        )}
      </main>
    </div>
  )
}
