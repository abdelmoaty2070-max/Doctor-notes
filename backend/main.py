import os
import json
import sqlite3
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Doctor Notes API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_DIR = "/tmp" if os.getenv("VERCEL") else os.path.dirname(__file__)
DB_PATH = os.path.join(DB_DIR, "doctor_notes.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_name TEXT NOT NULL,
            specialty TEXT NOT NULL,
            dialect TEXT NOT NULL,
            patient_name TEXT,
            soap_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


class LoginRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = "د. عبد المعطي"
    specialty: Optional[str] = "طب عام وباطنية"
    clinic: Optional[str] = "عيادة الرعاية الذكية"


class SoapNote(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str
    medications: List[str]
    clinical_summary: str


class SaveSessionRequest(BaseModel):
    doctor_name: str
    specialty: str
    dialect: str
    patient_name: Optional[str] = "مريض غير مسمى"
    soap: SoapNote


DEMO_SOAP = {
    "subjective": "يشكو المريض (أحمد، 42 سنة) من صداع نصفي متكرر منذ 3 أيام يزداد مع الإضاءة القوية، مصحوباً بغثيان خفيف وإرهاق عام بسبب قلة النوم.",
    "objective": "المريض واعٍ ومدرك، العلامات الحيوية مستقرة: ضغط الدم 125/80 مم زئبق، النبض 76 نبضة/دقيقة، درجة الحرارة 36.8°م. لا توجد علامات عصبية بؤرية.",
    "assessment": "صداع نصفي حاد (Acute Migraine without Aura) محفّز بالإجهاد وقلة النوم.",
    "plan": "1. الراحة في غرفة هادئة ومظلمة.\n2. الإكثار من شرب السوائل.\n3. تجنب المنبهات والشاشات لمدة 48 ساعة.\n4. مراجعة العيادة في حال استمرار الصداع أكثر من 5 أيام أو ظهور أعراض جديدة.",
    "medications": [
        "Sumatriptan 50mg — قرص واحد عند بداية النوبة (بحد أقصى قرصين يومياً)",
        "Paracetamol 500mg — قرصان كل 8 ساعات عند اللزوم",
        "Metoclopramide 10mg — قرص قبل الأكل عند اللزوم للغثيان"
    ],
    "clinical_summary": "حالة صداع نصفي حاد مستقرة؛ تم وصف العلاج الإسعافي والوقائي مع إرشادات الراحة والمتابعة."
}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Doctor Notes API"}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    # MVP simple authentication for demo & testing
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="يرجى إدخال البريد الإلكتروني وكلمة المرور")
    return {
        "token": "mvp-demo-token-2026",
        "doctor": {
            "name": req.name or "د. عبد المعطي",
            "specialty": req.specialty or "طب عام وباطنية",
            "clinic": req.clinic or "عيادة الرعاية الذكية",
            "email": req.email,
        },
    }


@app.post("/api/sessions/process")
async def process_audio(
    audio: Optional[UploadFile] = File(None),
    doctor_name: str = Form("د. عبد المعطي"),
    specialty: str = Form("طب عام"),
    dialect: str = Form("المصرية"),
    demo_mode: bool = Form(False),
):
    if demo_mode or audio is None:
        return {"soap": DEMO_SOAP, "mode": "demo"}

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        # Graceful fallback to demo data if API key is not configured yet
        return {
            "soap": DEMO_SOAP,
            "mode": "demo_fallback",
            "notice": "تم استخدام البيانات التجريبية لعدم ضبط مفتاح GEMINI_API_KEY بعد.",
        }

    try:
        from google import genai
        from google.genai import types

        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/webm"

        client = genai.Client(api_key=api_key)
        prompt = f"""طبيب ({doctor_name}، {specialty}) ومريض باللهجة {dialect}. حوّل الحوار إلى تقرير SOAP طبي عربي مهني بصيغة JSON فقط بهذه المفاتيح:
{{"subjective":"","objective":"","assessment":"","plan":"","medications":[""],"clinical_summary":""}}"""
        last_err = None
        response = None
        for model_name in ["gemini-3.8-flash", "gemini-3.8-pro"]:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[
                        types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                        prompt,
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    ),
                )
                break
            except Exception as model_err:
                last_err = model_err
                continue
        if response is None:
            raise last_err
        soap_data = json.loads(response.text)
        return {"soap": soap_data, "mode": "ai"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"فشلت معالجة الصوت: {str(e)}")


@app.post("/api/sessions/save")
def save_session(req: SaveSessionRequest):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    created_at = datetime.now().isoformat()
    c.execute(
        """
        INSERT INTO sessions (doctor_name, specialty, dialect, patient_name, soap_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            req.doctor_name,
            req.specialty,
            req.dialect,
            req.patient_name,
            req.soap.model_dump_json(),
            created_at,
        ),
    )
    session_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"id": session_id, "created_at": created_at, "status": "saved"}


@app.get("/api/sessions")
def list_sessions():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    rows = c.execute("SELECT * FROM sessions ORDER BY id DESC LIMIT 20").fetchall()
    conn.close()
    result = []
    for r in rows:
        result.append(
            {
                "id": r["id"],
                "doctor_name": r["doctor_name"],
                "specialty": r["specialty"],
                "dialect": r["dialect"],
                "patient_name": r["patient_name"],
                "soap": json.loads(r["soap_json"]),
                "created_at": r["created_at"],
            }
        )
    return {"sessions": result}
