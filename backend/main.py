import os
import re
import json
import time
import sqlite3
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Doctor Notes API", version="1.2.0")

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
    name: Optional[str] = "د. السيد إبراهيم"
    specialty: Optional[str] = "جراحة قلب وأوعية دموية"
    clinic: Optional[str] = "عيادة الرعاية الذكية"


class SoapNote(BaseModel):
    subjective: str = Field(default="", description="الشكوى الرئيسية وتاريخ المرض الحالي كما ذكرها المريض")
    objective: str = Field(default="", description="الفحص السريري والعلامات الحيوية المذكورة في الجلسة")
    assessment: str = Field(default="", description="التقييم الطبي والتشخيص المبدئي أو التفريقي")
    plan: str = Field(default="", description="الخطة العلاجية والإرشادات والمتابعة")
    medications: List[str] = Field(default_factory=list, description="قائمة الأدوية والجرعات المقترحة")
    clinical_summary: str = Field(default="", description="ملخص إكلينيكي سريع ومكثف في سطر واحد")


class SaveSessionRequest(BaseModel):
    doctor_name: str
    specialty: str
    dialect: str
    patient_name: Optional[str] = "مريض غير مسمى"
    soap: SoapNote


DEMO_SCENARIOS = {
    "cardiology": {
        "patient_name": "محمود عبد الرحمن (58 سنة)",
        "soap": {
            "subjective": "يشكو المريض (58 سنة، مدخن سابق ومصاب بارتفاع ضغط الدم) من ألم ضاغط في منتصف الصدر يمتد أحياناً إلى الكتف الأيسر عند صعود السلم أو بذل مجهود منذ أسبوعين، ويختفي خلال 5 دقائق من الراحة، مع نهجان خفيف.",
            "objective": "المريض واعٍ ومتعاون. العلامات الحيوية: ضغط الدم 145/90 مم زئبق، النبض 84 نبضة/دقيقة منتظم، تشبع الأكسجين 97%. أصوات القلب S1 و S2 منتظمة بدون لغط واضح، والرئتان صافيتان، ولا يوجد تورم بالقدمين.",
            "assessment": "اشتباه ذبحة صدرية مستقرة (Stable Angina Pectoris) مع ارتفاع ضغط دم غير منضبط.",
            "plan": "1. إجراء رسم قلب بالمجهود (Exercise Stress ECG) وإيكو على القلب (Echocardiography).\n2. تحاليل صورة دم كاملة، ملف الدهون الكامل (Lipid Profile)، والسكر التراكمي HbA1c.\n3. تقليل الملح والدهون المشبعة والامتناع عن المجهود البدني العنيف لحين ظهور الفحوصات.\n4. التوجه للطوارئ فوراً في حال استمرار ألم الصدر أكثر من 15 دقيقة وقت الراحة.",
            "medications": [
                "Aspirin Protect 100mg — قرص واحد يومياً بعد الغداء",
                "Bisoprolol 5mg — قرص واحد صباحاً يومياً",
                "Atorvastatin 40mg — قرص واحد مساءً يومياً",
                "Nitroglycerin 0.5mg تحت اللسان — قرص عند الشعور بألم الصدر"
            ],
            "clinical_summary": "اشتباه ذبحة صدرية مستقرة لمريض ضغط؛ تم بدء العلاج الدوائي الواقي وطلب إيكو ورسم قلب بالمجهود."
        },
    },
    "migraine": {
        "patient_name": "أحمد محمد (42 سنة)",
        "soap": {
            "subjective": "يشكو المريض (42 سنة) من صداع نصفي نابض متكرر في الجانب الأيمن منذ 3 أيام يزداد مع الإضاءة القوية والضوضاء، مصحوباً بغثيان خفيف وإرهاق عام بسبب قلة النوم وضغط العمل.",
            "objective": "المريض واعٍ ومدرك، العلامات الحيوية مستقرة: ضغط الدم 125/80 مم زئبق، النبض 76 نبضة/دقيقة، درجة الحرارة 36.8°م. الفحص العصبي سليم ولا توجد علامات عصبية بؤرية أو تيبس بالرقبة.",
            "assessment": "صداع نصفي حاد بدون هالة (Acute Migraine without Aura) محفّز بالإجهاد وقلة النوم.",
            "plan": "1. الراحة في غرفة هادئة وخافتة الإضاءة عند بدء النوبة.\n2. الإكثار من شرب الماء والسوائل وتنظيم ساعات النوم.\n3. تقليل الكافيين والشاشات لمدة 48 ساعة.\n4. مراجعة العيادة في حال استمرار الصداع أكثر من 5 أيام أو ظهور زغللة بالعين.",
            "medications": [
                "Sumatriptan 50mg — قرص واحد عند بداية النوبة (بحد أقصى قرصين يومياً)",
                "Paracetamol 500mg — قرصان كل 8 ساعات عند اللزوم",
                "Metoclopramide 10mg — قرص قبل الأكل بربع ساعة عند اللزوم للغثيان"
            ],
            "clinical_summary": "حالة صداع نصفي حاد مستقرة؛ تم وصف العلاج الإسعافي والوقائي مع إرشادات الراحة والمتابعة."
        },
    },
}

# Candidate models ordered from fastest/latest multimodal Flash to stable fallbacks
CANDIDATE_MODELS = [
    ("gemini-3.8-flash", True),
    ("gemini-3.6-flash", True),
    ("gemini-3.5-flash-lite", False),
    ("gemini-2.5-flash", False),
    ("gemini-2.0-flash", False),
]


def normalize_audio_mime(content_type: Optional[str], filename: Optional[str]) -> str:
    """Strip codec parameters (e.g. 'audio/webm;codecs=opus' -> 'audio/webm') so Gemini accepts it cleanly."""
    raw = (content_type or "").split(";")[0].strip().lower()
    mapping = {
        "audio/webm": "audio/webm",
        "video/webm": "audio/webm",
        "audio/mp4": "audio/mp4",
        "video/mp4": "audio/mp4",
        "audio/x-m4a": "audio/mp4",
        "audio/m4a": "audio/m4a",
        "audio/aac": "audio/aac",
        "audio/ogg": "audio/ogg",
        "application/ogg": "audio/ogg",
        "audio/opus": "audio/ogg",
        "audio/mpeg": "audio/mp3",
        "audio/mp3": "audio/mp3",
        "audio/wav": "audio/wav",
        "audio/x-wav": "audio/wav",
        "audio/wave": "audio/wav",
    }
    if raw in mapping:
        return mapping[raw]

    ext = os.path.splitext(filename or "")[1].lower()
    ext_map = {
        ".webm": "audio/webm",
        ".mp4": "audio/mp4",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".opus": "audio/ogg",
        ".mp3": "audio/mp3",
        ".wav": "audio/wav",
    }
    return ext_map.get(ext, "audio/webm")


def parse_soap_json(raw_text: str) -> dict:
    """Safely extract and normalize SOAP JSON even if the model wraps it in markdown fences."""
    cleaned = (raw_text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            raise ValueError("لم يتمكن النموذج من إرجاع بيانات منظمة صالحة")
        data = json.loads(match.group(0))

    if isinstance(data, list) and data:
        data = data[0]
    if not isinstance(data, dict):
        raise ValueError("صيغة الاستجابة غير متوقعة")

    meds = data.get("medications") or []
    if isinstance(meds, str):
        meds = [m.strip() for m in meds.split("\n") if m.strip()]
    elif isinstance(meds, list):
        meds = [str(m).strip() for m in meds if str(m).strip()]
    else:
        meds = []

    def clean_str(val, fallback="غير مذكور في التسجيل"):
        if val is None:
            return fallback
        if isinstance(val, list):
            joined = "\n".join(str(x).strip() for x in val if str(x).strip())
            return joined or fallback
        s = str(val).strip()
        return s or fallback

    return {
        "subjective": clean_str(data.get("subjective")),
        "objective": clean_str(data.get("objective")),
        "assessment": clean_str(data.get("assessment")),
        "plan": clean_str(data.get("plan")),
        "medications": meds,
        "clinical_summary": clean_str(data.get("clinical_summary"), "تم توثيق الجلسة الطبية بنجاح."),
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "Doctor Notes API",
        "version": "1.2.0",
        "ai_configured": bool(os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_API_KEY") != "your_gemini_api_key_here"),
    }


@app.post("/api/auth/login")
def login(req: LoginRequest):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="يرجى إدخال البريد الإلكتروني وكلمة المرور")
    return {
        "token": "mvp-demo-token-2026",
        "doctor": {
            "name": req.name or "د. السيد إبراهيم",
            "specialty": req.specialty or "جراحة قلب وأوعية دموية",
            "clinic": req.clinic or "عيادة الرعاية الذكية",
            "email": req.email,
        },
    }


@app.post("/api/sessions/process")
async def process_audio(
    audio: Optional[UploadFile] = File(None),
    doctor_name: str = Form("د. السيد إبراهيم"),
    specialty: str = Form("جراحة قلب وأوعية دموية"),
    dialect: str = Form("المصرية"),
    demo_mode: bool = Form(False),
    demo_scenario: str = Form("cardiology"),
):
    start_ts = time.time()
    scenario = DEMO_SCENARIOS.get(demo_scenario, DEMO_SCENARIOS["cardiology"])

    if demo_mode or audio is None:
        return {
            "soap": scenario["soap"],
            "suggested_patient": scenario["patient_name"],
            "mode": "demo",
            "processing_seconds": round(time.time() - start_ts, 2),
        }

    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key or api_key == "your_gemini_api_key_here":
        return {
            "soap": scenario["soap"],
            "suggested_patient": scenario["patient_name"],
            "mode": "demo_fallback",
            "notice": "تم استخدام البيانات التجريبية لعدم ضبط مفتاح GEMINI_API_KEY بعد.",
            "processing_seconds": round(time.time() - start_ts, 2),
        }

    audio_bytes = await audio.read()
    if not audio_bytes or len(audio_bytes) < 200:
        raise HTTPException(
            status_code=400,
            detail="التسجيل الصوتي قصير جداً أو فارغ. يرجى التحدث لبضع ثوانٍ ثم المحاولة مرة أخرى.",
        )

    mime_type = normalize_audio_mime(audio.content_type, audio.filename)

    try:
        from google import genai
        from google.genai import types

        # Set a per-request HTTP timeout (25s) so a slow/overloaded model fails fast to the next fallback
        try:
            client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(timeout=25_000),
            )
        except Exception:
            client = genai.Client(api_key=api_key)

        prompt = (
            f"أنت مساعد توثيق طبي إكلينيكي خبير. استمع لهذا الحوار بين الطبيب ({doctor_name}، تخصص: {specialty}) "
            f"والمريض المتحدث باللهجة {dialect}. "
            "حوّل الحوار بدقة وسرعة إلى تقرير SOAP طبي عربي مهني ومنظم بصيغة JSON فقط بدون أي شرح إضافي:\n"
            '{"subjective":"الشكوى وتاريخ المرض الحالي","objective":"الفحص والعلامات الحيوية المذكورة أو غير مذكور",'
            '"assessment":"التشخيص المبدئي","plan":"الخطة العلاجية والإرشادات مرقمة",'
            '"medications":["الدواء والجرعة والتكرار"],"clinical_summary":"ملخص إكلينيكي مركز في سطر واحد"}'
        )

        audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
        errors_log = []
        response = None
        used_model = None

        for model_name, use_low_thinking in CANDIDATE_MODELS:
            # Build config with low thinking latency if supported by the SDK & model
            config_kwargs = {
                "response_mime_type": "application/json",
                "response_schema": SoapNote,
                "temperature": 0.2,
            }
            if use_low_thinking and hasattr(types, "ThinkingConfig"):
                try:
                    config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level="low")
                except Exception:
                    pass

            try:
                gen_config = types.GenerateContentConfig(**config_kwargs)
            except Exception:
                gen_config = types.GenerateContentConfig(response_mime_type="application/json")

            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[audio_part, prompt],
                    config=gen_config,
                )
                if response and getattr(response, "text", None):
                    used_model = model_name
                    break
            except Exception as model_err:
                err_str = str(model_err)
                errors_log.append(f"{model_name}: {err_str[:120]}")
                # If ThinkingConfig caused an argument error on an older SDK/endpoint, retry same model cleanly
                if "thinking" in err_str.lower() or "INVALID_ARGUMENT" in err_str:
                    try:
                        fallback_cfg = types.GenerateContentConfig(response_mime_type="application/json")
                        response = client.models.generate_content(
                            model=model_name,
                            contents=[audio_part, prompt],
                            config=fallback_cfg,
                        )
                        if response and getattr(response, "text", None):
                            used_model = model_name
                            break
                    except Exception as retry_err:
                        errors_log.append(f"{model_name}(plain): {str(retry_err)[:120]}")
                continue

        if response is None or not getattr(response, "text", None):
            joined_errors = " | ".join(errors_log[-2:]) if errors_log else "تعذر الاتصال بخدمة الذكاء الاصطناعي"
            raise RuntimeError(joined_errors)

        soap_data = parse_soap_json(response.text)
        elapsed = round(time.time() - start_ts, 2)
        return {
            "soap": soap_data,
            "mode": "ai",
            "model": used_model,
            "processing_seconds": elapsed,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"تعذر إتمام التحليل الصوتي حالياً ({str(e)[:180]}). يمكنك الضغط على إعادة المحاولة أو رفع الملف.",
        )


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
