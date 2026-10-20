import React, { useState, useEffect, useRef } from "react";
import {
  Camera, ChefHat, Sparkles, ArrowRight, ArrowLeft,
  Plus, Minus, Trash2, Check, X, Loader2,
  Clock, Flame, Target, Activity, Moon, Dumbbell,
  BookOpen, Utensils, ChevronRight, Upload, AlertCircle,
  RefreshCw, Home, Package, User, Search, Star,
  TrendingUp, Zap, Heart, BarChart2, ShoppingBag,
  CheckCircle, XCircle,
} from "lucide-react";

/* ===================================================================== */
/*  CLAUDE API                                                            */
/* ===================================================================== */
async function callClaude(systemPrompt, userContent) {
  const key = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!key) throw new Error("API key not configured");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.content[0].text;
}

function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch {} }
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  const sa = text.indexOf("["), ea = text.lastIndexOf("]");
  if (sa !== -1 && ea !== -1) {
    try { return JSON.parse(text.slice(sa, ea + 1)); } catch {}
  }
  return null;
}

/* ===================================================================== */
/*  STORAGE                                                               */
/* ===================================================================== */
const storage = {
  get(k, d) {
    try {
      if (window.storage?.get) return window.storage.get(k) ?? d;
      const v = localStorage.getItem(k);
      return v !== null ? JSON.parse(v) : d;
    } catch { return d; }
  },
  set(k, v) {
    try {
      if (window.storage?.set) { window.storage.set(k, v); return; }
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

/* ===================================================================== */
/*  CONFIG                                                                */
/* ===================================================================== */
const CATEGORIES = {
  proteina:     { bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500",   label: "Proteina",     icon: "🥩" },
  carbohidrato: { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500",  label: "Carbohidrato", icon: "🌾" },
  verdura:      { bg: "bg-emerald-100",text: "text-emerald-700",dot: "bg-emerald-500",label: "Verdura",      icon: "🥦" },
  fruta:        { bg: "bg-pink-100",   text: "text-pink-600",   dot: "bg-pink-500",   label: "Fruta",        icon: "🍎" },
  lacteo:       { bg: "bg-sky-100",    text: "text-sky-700",    dot: "bg-sky-500",    label: "Lacteo",       icon: "🥛" },
  grasa:        { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500", label: "Grasa",        icon: "🫒" },
  otros:        { bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400",   label: "Otros",        icon: "🧂" },
};

const ACTIVITY = [
  { id: "sedentario",  label: "Sedentario",   desc: "Trabajo de escritorio, poco movimiento" },
  { id: "ligero",      label: "Ligero",        desc: "Caminatas, actividad leve" },
  { id: "moderado",    label: "Moderado",      desc: "Ejercicio 3-4 dias por semana" },
  { id: "activo",      label: "Activo",        desc: "Ejercicio 5-6 dias por semana" },
  { id: "muy_activo",  label: "Muy activo",    desc: "Ejercicio intenso diario" },
];

const TRAINING = [
  { id: "ninguno",     label: "Sin entrenamiento", icon: "😴" },
  { id: "cardio",      label: "Cardio",             icon: "🏃" },
  { id: "fuerza",      label: "Fuerza",             icon: "🏋️" },
  { id: "mixto",       label: "Mixto",              icon: "⚡" },
  { id: "yoga",        label: "Yoga / pilates",     icon: "🧘" },
  { id: "deporte",     label: "Deporte en equipo",  icon: "⚽" },
];

const GOALS = [
  { id: "bajar_peso",  label: "Bajar de peso",  icon: "📉" },
  { id: "mantener",    label: "Mantener peso",  icon: "⚖️" },
  { id: "subir_masa",  label: "Ganar musculo",  icon: "💪" },
  { id: "energia",     label: "Mas energia",    icon: "⚡" },
  { id: "salud",       label: "Mejorar salud",  icon: "❤️" },
];

const RESTRICTIONS = [
  { id: "ninguna",     label: "Ninguna" },
  { id: "vegetariano", label: "Vegetariano" },
  { id: "vegano",      label: "Vegano" },
  { id: "celiaco",     label: "Celiaco" },
  { id: "intolerante", label: "Intolerante a la lactosa" },
  { id: "diabetico",   label: "Diabetico" },
];

/* ===================================================================== */
/*  APP COMPONENT                                                         */
/* ===================================================================== */
export default function App() {
  const [screen, setScreen] = useState("boot");
  const [tab, setTab] = useState("home");
  const [profile, setProfile] = useState(null);
  const [pantry, setPantry] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const p = storage.get("profile", null);
    const pa = storage.get("pantry", []);
    const rc = storage.get("recipes", []);
    setPantry(pa);
    setRecipes(rc);
    setTimeout(() => {
      if (p) { setProfile(p); setScreen("app"); }
      else setScreen("onboarding");
    }, 3000);
  }, []);

  function showToast(text, type = "success") {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }

  function saveProfile(p) {
    storage.set("profile", p);
    setProfile(p);
    setScreen("app");
  }

  function savePantry(items) {
    storage.set("pantry", items);
    setPantry(items);
  }

  function saveRecipes(rs) {
    storage.set("recipes", rs);
    setRecipes(rs);
  }

  if (screen === "boot") return <BootScreen />;
  if (screen === "onboarding") return <Onboarding onComplete={saveProfile} />;

  return (
    <div className="min-h-screen bg-gray-50 font-body">
      <GlobalStyles />
      <div className="mx-auto max-w-[500px] relative min-h-screen">
        {tab === "home"    && <HomeTab profile={profile} pantry={pantry} recipes={recipes} setTab={setTab} />}
        {tab === "pantry"  && <PantryTab pantry={pantry} savePantry={savePantry} showToast={showToast} />}
        {tab === "recipes" && <RecipesTab profile={profile} pantry={pantry} recipes={recipes} saveRecipes={saveRecipes} savePantry={savePantry} showToast={showToast} />}
        {tab === "profile" && <ProfileTab profile={profile} saveProfile={saveProfile} showToast={showToast} />}
        {/* Consultatia credit — visible above tab bar on all screens */}
        <div className="fixed bottom-[88px] left-0 right-0 z-20 flex justify-center pointer-events-none">
          <a href="https://consultatia.com.ar/" target="_blank" rel="noopener noreferrer"
            className="pointer-events-auto flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border border-gray-100 rounded-full px-3 py-1 shadow-sm">
            <span className="text-[10px] text-gray-400 font-medium">Powered by</span>
            <span className="text-[10px] font-extrabold tracking-tight text-gray-800">CONSULTAT<span className="text-blue-600">IA</span></span>
          </a>
        </div>
        <TabBar tab={tab} setTab={setTab} />
        {toast && <Toast toast={toast} />}
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  GLOBAL STYLES                                                         */
/* ===================================================================== */
function GlobalStyles() {
  return (
    <style>{`
      * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
      body { margin: 0; background: #f1f5f9; font-family: 'Inter', 'Manrope', system-ui, sans-serif; }
      .press { transition: transform 0.1s ease; }
      .press:active { transform: scale(0.96); }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
      @keyframes popIn   { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      .animate-slide-up { animation: slideUp 0.4s ease forwards; }
      .animate-fade-in  { animation: fadeIn 0.3s ease forwards; }
      .animate-pop-in   { animation: popIn 0.25s ease forwards; }
      @keyframes leafGrow { from { opacity: 0; transform: scale(0.4) rotate(-12deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
      @keyframes drawLine { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
      @keyframes dotPop   { 0% { opacity: 0; transform: scale(0); } 70% { opacity: 1; transform: scale(1.6); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes haloPulse { 0%,100% { transform: scale(1); opacity: 0.25; } 50% { transform: scale(1.15); opacity: 0.4; } }
      @keyframes loadBar { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      .logo-leaf  { animation: leafGrow 0.7s cubic-bezier(.2,.8,.2,1) both; }
      .logo-vein  { stroke-dasharray: 1; stroke-dashoffset: 1; animation: drawLine 0.6s ease 0.5s forwards; }
      .logo-spark { stroke-dasharray: 1; stroke-dashoffset: 1; animation: drawLine 0.6s ease 0.9s forwards; }
      .logo-dot   { transform-box: fill-box; transform-origin: center; opacity: 0; animation: dotPop 0.4s ease 1.4s forwards; }
      .boot-title { opacity: 0; animation: slideUp 0.5s ease 1.0s forwards; }
      .boot-sub   { opacity: 0; animation: fadeIn 0.5s ease 1.3s forwards; }
      .boot-credit { opacity: 0; animation: fadeIn 0.6s ease 1.5s forwards; }
      .boot-halo  { position: absolute; width: 320px; height: 320px; border-radius: 9999px; background: radial-gradient(circle, rgba(255,255,255,0.35), rgba(255,255,255,0) 70%); animation: haloPulse 2.4s ease-in-out infinite; }
      .boot-bar   { width: 120px; height: 3px; border-radius: 9999px; background: rgba(255,255,255,0.25); overflow: hidden; opacity: 0; animation: fadeIn 0.4s ease 1.4s forwards; }
      .boot-bar span { display: block; height: 100%; background: #fff; border-radius: 9999px; animation: loadBar 1.4s ease-in-out 1.5s both; }
    `}</style>
  );
}

/* ===================================================================== */
/*  LOGO + BOOT SCREEN                                                    */
/* ===================================================================== */
function CooachLogo({ size = 120, leaf = "#ffffff", vein = "#10b981", spark = "#ffffff", animated = true }) {
  return (
    <svg viewBox="30 8 150 215" width={size} height={size * 215 / 150} aria-label="CooachIA" role="img">
      <g className={animated ? "logo-leaf" : ""} style={{ transformOrigin: "80px 130px" }}>
        <path d="M120 40 C140 100, 100 180, 40 210 C70 150, 80 100, 120 40 Z" fill={leaf} opacity="0.2" />
        <path d="M110 50 C130 105, 95 170, 45 200 C75 145, 80 100, 110 50 Z" fill={leaf} />
      </g>
      <path className={animated ? "logo-vein" : ""} pathLength="1"
        d="M110 50 C90 110, 70 160, 45 200" stroke={vein} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.9" />
      <path className={animated ? "logo-spark" : ""} pathLength="1"
        d="M150 20 L135 75 L165 85 L145 140" fill="none" stroke={spark} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle className={animated ? "logo-dot" : ""} cx="150" cy="20" r="5" fill={spark} />
    </svg>
  );
}

function BootScreen() {
  return (
    <div className="fixed inset-0 bg-emerald-500 flex flex-col items-center justify-center overflow-hidden">
      <GlobalStyles />
      <div className="boot-halo" />
      <div className="relative flex flex-col items-center">
        <CooachLogo size={112} />
        <h1 className="boot-title text-white text-4xl font-extrabold tracking-tight mt-5">Cooach<span className="text-emerald-200">IA</span></h1>
        <p className="boot-sub text-emerald-100 text-sm mt-1.5">Tu coach nutricional con IA</p>
        <div className="boot-bar mt-8"><span /></div>
      </div>
      <a href="https://consultatia.com.ar/" target="_blank" rel="noopener noreferrer"
        className="boot-credit absolute bottom-[max(2rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-1">
        <span className="text-[11px] text-emerald-100/80 font-medium tracking-wide">Powered by</span>
        <span className="text-base font-extrabold tracking-tight text-white" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          CONSULTAT<span className="text-blue-200">IA</span>
        </span>
      </a>
    </div>
  );
}

/* ===================================================================== */
/*  ONBOARDING                                                            */
/* ===================================================================== */
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: "", age: "", weight: "", height: "", gender: "masculino",
    activity: "", training: "", goal: "", restrictions: [],
  });

  const steps = ["welcome", "basics", "lifestyle", "training", "goals", "restrictions", "done"];
  const total = steps.length;

  function next(patch = {}) {
    setData(d => ({ ...d, ...patch }));
    if (step < total - 1) setStep(s => s + 1);
    else onComplete({ ...data, ...patch });
  }
  function back() { setStep(s => Math.max(0, s - 1)); }

  const stepName = steps[step];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <GlobalStyles />
      {step > 0 && step < total - 1 && (
        <div className="px-5 pt-12 pb-2">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={back} className="p-2 rounded-full bg-gray-100 press">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${(step / (total - 2)) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 font-medium w-10 text-right">{step}/{total - 2}</span>
          </div>
        </div>
      )}

      <div className="flex-1 px-5 pb-8">
        {stepName === "welcome"      && <StepWelcome onNext={() => next()} />}
        {stepName === "basics"       && <StepBasics data={data} onNext={next} />}
        {stepName === "lifestyle"    && <StepLifestyle data={data} onNext={next} />}
        {stepName === "training"     && <StepTraining data={data} onNext={next} />}
        {stepName === "goals"        && <StepGoals data={data} onNext={next} />}
        {stepName === "restrictions" && <StepRestrictions data={data} onNext={next} />}
        {stepName === "done"         && <StepDone data={data} onNext={() => onComplete(data)} />}
      </div>
    </div>
  );
}

function StepWelcome({ onNext }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center gap-6 animate-slide-up">
      <div className="w-28 h-28 bg-emerald-50 rounded-[2rem] flex items-center justify-center shadow-lg">
        <span className="text-6xl">🥗</span>
      </div>
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Hola! Soy tu</h1>
        <h1 className="text-3xl font-extrabold text-emerald-500 mb-4">Cooach<span className="text-gray-900">IA</span></h1>
        <p className="text-gray-500 text-base leading-relaxed max-w-xs mx-auto">
          En 2 minutos te configuro un plan personalizado con IA para alcanzar tus objetivos.
        </p>
      </div>
      <button onClick={onNext}
        className="press w-full max-w-xs bg-emerald-500 text-white rounded-2xl py-4 font-bold text-lg shadow-lg shadow-emerald-200 flex items-center justify-center gap-2">
        Empezar <ArrowRight className="w-5 h-5" />
      </button>
      <p className="text-gray-400 text-xs">Es rapido, privado y gratuito</p>
    </div>
  );
}

function OnboardingField({ label, type = "text", value, onChange, placeholder, suffix }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all"
        />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </div>
  );
}

function StepBasics({ data, onNext }) {
  const [local, setLocal] = useState({ name: data.name, age: data.age, weight: data.weight, height: data.height, gender: data.gender });
  const valid = local.name && local.age && local.weight && local.height;
  return (
    <div className="flex flex-col gap-5 animate-slide-up">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Cuentame sobre vos</h2>
        <p className="text-gray-500 text-sm">Necesito estos datos para calcular tus calorias</p>
      </div>
      <OnboardingField label="Tu nombre" value={local.name} onChange={v => setLocal(d=>({...d,name:v}))} placeholder="Ej: Maria" />
      <OnboardingField label="Edad" type="number" value={local.age} onChange={v => setLocal(d=>({...d,age:v}))} placeholder="25" suffix="años" />
      <div className="grid grid-cols-2 gap-3">
        <OnboardingField label="Peso" type="number" value={local.weight} onChange={v => setLocal(d=>({...d,weight:v}))} placeholder="70" suffix="kg" />
        <OnboardingField label="Altura" type="number" value={local.height} onChange={v => setLocal(d=>({...d,height:v}))} placeholder="170" suffix="cm" />
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">Sexo biologico</label>
        <div className="grid grid-cols-2 gap-2">
          {[{id:"masculino",label:"Masculino",icon:"♂"},{id:"femenino",label:"Femenino",icon:"♀"}].map(g => (
            <button key={g.id} onClick={() => setLocal(d=>({...d,gender:g.id}))}
              className={`press py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border-2 transition-all ${
                local.gender === g.id
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-gray-50 text-gray-600 border-gray-200"
              }`}>
              <span>{g.icon}</span>{g.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => onNext(local)} disabled={!valid}
        className={`press w-full rounded-2xl py-4 font-bold text-base mt-2 ${valid ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-gray-100 text-gray-400"}`}>
        Continuar
      </button>
    </div>
  );
}

function StepLifestyle({ data, onNext }) {
  const [selected, setSelected] = useState(data.activity || "");
  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Tu nivel de actividad</h2>
        <p className="text-gray-500 text-sm">Que tan activo sos en tu dia a dia?</p>
      </div>
      <div className="flex flex-col gap-2">
        {ACTIVITY.map(a => (
          <button key={a.id} onClick={() => setSelected(a.id)}
            className={`press flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
              selected === a.id ? "border-emerald-500 bg-emerald-50" : "border-gray-100 bg-gray-50"
            }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${selected === a.id ? "bg-emerald-500" : "bg-white"}`}>
              <Activity className={`w-5 h-5 ${selected === a.id ? "text-white" : "text-gray-400"}`} />
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${selected === a.id ? "text-emerald-700" : "text-gray-800"}`}>{a.label}</p>
              <p className="text-gray-400 text-xs mt-0.5">{a.desc}</p>
            </div>
            {selected === a.id && <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
          </button>
        ))}
      </div>
      <button onClick={() => onNext({ activity: selected })} disabled={!selected}
        className={`press w-full rounded-2xl py-4 font-bold text-base mt-2 ${selected ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-gray-100 text-gray-400"}`}>
        Continuar
      </button>
    </div>
  );
}

function StepTraining({ data, onNext }) {
  const [selected, setSelected] = useState(data.training || "");
  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Como entrenás?</h2>
        <p className="text-gray-500 text-sm">El tipo de entrenamiento afecta tus necesidades nutricionales</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TRAINING.map(t => (
          <button key={t.id} onClick={() => setSelected(t.id)}
            className={`press p-4 rounded-2xl border-2 text-center transition-all ${
              selected === t.id ? "border-emerald-500 bg-emerald-50" : "border-gray-100 bg-gray-50"
            }`}>
            <span className="text-2xl">{t.icon}</span>
            <p className={`mt-1 text-xs font-semibold ${selected === t.id ? "text-emerald-700" : "text-gray-600"}`}>{t.label}</p>
          </button>
        ))}
      </div>
      <button onClick={() => onNext({ training: selected })} disabled={!selected}
        className={`press w-full rounded-2xl py-4 font-bold text-base mt-2 ${selected ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-gray-100 text-gray-400"}`}>
        Continuar
      </button>
    </div>
  );
}

function StepGoals({ data, onNext }) {
  const [selected, setSelected] = useState(data.goal || "");
  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Tu objetivo principal</h2>
        <p className="text-gray-500 text-sm">Que queres lograr con tu alimentacion?</p>
      </div>
      <div className="flex flex-col gap-2">
        {GOALS.map(g => (
          <button key={g.id} onClick={() => setSelected(g.id)}
            className={`press flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
              selected === g.id ? "border-emerald-500 bg-emerald-50" : "border-gray-100 bg-gray-50"
            }`}>
            <span className="text-2xl">{g.icon}</span>
            <span className={`font-semibold text-sm flex-1 ${selected === g.id ? "text-emerald-700" : "text-gray-800"}`}>{g.label}</span>
            {selected === g.id && <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
          </button>
        ))}
      </div>
      <button onClick={() => onNext({ goal: selected })} disabled={!selected}
        className={`press w-full rounded-2xl py-4 font-bold text-base mt-2 ${selected ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-gray-100 text-gray-400"}`}>
        Continuar
      </button>
    </div>
  );
}

function StepRestrictions({ data, onNext }) {
  const [selected, setSelected] = useState(data.restrictions || []);
  function toggle(id) {
    if (id === "ninguna") { setSelected(["ninguna"]); return; }
    setSelected(prev => {
      const without = prev.filter(x => x !== "ninguna");
      return without.includes(id) ? without.filter(x => x !== id) : [...without, id];
    });
  }
  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Restricciones alimentarias</h2>
        <p className="text-gray-500 text-sm">Selecciona todas las que apliquen</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {RESTRICTIONS.map(r => {
          const active = selected.includes(r.id);
          return (
            <button key={r.id} onClick={() => toggle(r.id)}
              className={`press py-3.5 px-4 rounded-2xl border-2 font-semibold text-sm transition-all ${
                active ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-100 bg-gray-50 text-gray-600"
              }`}>
              {r.label}
            </button>
          );
        })}
      </div>
      <button onClick={() => onNext({ restrictions: selected })}
        className="press w-full rounded-2xl py-4 font-bold text-base mt-2 bg-emerald-500 text-white shadow-lg shadow-emerald-200">
        Continuar
      </button>
    </div>
  );
}

function StepDone({ data, onNext }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center gap-6 animate-slide-up">
      <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center">
        <span className="text-5xl">🎉</span>
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Listo, {data.name}!</h2>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
          Tu perfil esta configurado. Ahora podes cargar tus ingredientes y generar recetas personalizadas.
        </p>
      </div>
      <div className="w-full max-w-xs space-y-2 text-left">
        {[
          { icon: "📸", text: "Fotografiá tu ticket de supermercado" },
          { icon: "🧠", text: "La IA detecta los ingredientes" },
          { icon: "👨‍🍳", text: "Recetas adaptadas a tus objetivos" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm text-gray-600 font-medium">{item.text}</span>
          </div>
        ))}
      </div>
      <button onClick={onNext}
        className="press w-full max-w-xs bg-emerald-500 text-white rounded-2xl py-4 font-bold text-lg shadow-lg shadow-emerald-200">
        Empezar a usar la app
      </button>
    </div>
  );
}

/* ===================================================================== */
/*  HOME TAB                                                              */
/* ===================================================================== */
function HomeTab({ profile, pantry, recipes, setTab }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos dias" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  const recentRecipes = recipes.slice(-3).reverse();
  const pantryCount = pantry.length;

  return (
    <div className="pb-28 animate-fade-in">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">{greeting} 👋</p>
            <h1 className="text-2xl font-extrabold text-gray-900 mt-0.5">
              {profile?.name || "Coach"}
            </h1>
          </div>
          <button onClick={() => setTab("profile")}
            className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-200 overflow-hidden">
            {profile?.photo
              ? <img src={profile.photo} alt="" className="w-full h-full object-cover" />
              : <User className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>

      {/* Hero Card */}
      <div className="mx-5 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 shadow-xl shadow-emerald-200 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-1">Tu objetivo</p>
            <p className="text-white font-bold text-lg">
              {GOALS.find(g => g.id === profile?.goal)?.label || "Alimentacion saludable"}
            </p>
          </div>
          <div className="bg-white/20 rounded-2xl p-2.5">
            <Target className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Ingredientes", value: pantryCount, icon: "🥬" },
            { label: "Recetas", value: recipes.length, icon: "👨‍🍳" },
            { label: "Esta semana", value: recipes.filter(r => {
              if (!r.cookedAt) return false;
              const d = new Date(r.cookedAt);
              const now = new Date();
              return (now - d) < 7 * 24 * 60 * 60 * 1000;
            }).length, icon: "✅" },
          ].map((stat, i) => (
            <div key={i} className="bg-white/15 rounded-2xl p-3 text-center">
              <span className="text-xl">{stat.icon}</span>
              <p className="text-white font-extrabold text-xl mt-1">{stat.value}</p>
              <p className="text-emerald-100 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 mb-5">
        <p className="text-gray-900 font-bold text-base mb-3">Acciones rapidas</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setTab("pantry")}
            className="press bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2 text-left">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Camera className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Escanear ticket</p>
              <p className="text-gray-400 text-xs mt-0.5">Fotografia tu compra</p>
            </div>
          </button>
          <button onClick={() => setTab("recipes")}
            className="press bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2 text-left">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Generar recetas</p>
              <p className="text-gray-400 text-xs mt-0.5">Con IA, para vos</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Recipes */}
      {recentRecipes.length > 0 && (
        <div className="px-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-900 font-bold text-base">Recetas recientes</p>
            <button onClick={() => setTab("recipes")} className="text-emerald-500 text-xs font-semibold">Ver todas</button>
          </div>
          <div className="flex flex-col gap-2">
            {recentRecipes.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🍽</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{r.name}</p>
                  {r.macros && (
                    <p className="text-gray-400 text-xs mt-0.5">
                      {r.macros.calorias} kcal · {r.macros.proteinas}g prot
                    </p>
                  )}
                </div>
                {r.cooked && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {pantryCount === 0 && (
        <div className="mx-5 mt-4 rounded-2xl bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-bold text-amber-800 text-sm">Comenzá aca</p>
            <p className="text-amber-600 text-xs mt-0.5 leading-relaxed">
              Fotografiá tu ticket de supermercado para cargar tus ingredientes automaticamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================================================================== */
/*  PANTRY TAB                                                            */
/* ===================================================================== */
function PantryTab({ pantry, savePantry, showToast }) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const fileRef = useRef();

  async function handlePhoto(file) {
    if (!file) return;
    setLoading(true);
    try {
      const b64 = await fileToBase64(file);
      const result = await callClaude(
        `Sos un asistente de nutricion. Analiza la imagen y extrae todos los alimentos/ingredientes que ves.
         Para cada uno determina su categoria: proteina, carbohidrato, verdura, fruta, lacteo, grasa, u otros.
         Devuelve SOLO JSON con este formato exacto:
         {"items": [{"name": "nombre", "quantity": "cantidad estimada o null", "category": "categoria", "unit": "kg/g/l/ml/unidades/null"}]}`,
        [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
         { type: "text", text: "Extrae todos los ingredientes de este ticket o imagen de supermercado." }]
      );
      const parsed = parseJSON(result);
      if (parsed?.items?.length) {
        const newItems = parsed.items.map((it, i) => ({
          id: Date.now() + i,
          name: it.name,
          quantity: it.quantity || "1",
          unit: it.unit || "unidades",
          category: it.category || "otros",
        }));
        savePantry([...pantry, ...newItems]);
        showToast(`${newItems.length} ingredientes agregados`);
      } else {
        showToast("No se encontraron ingredientes en la imagen", "error");
      }
    } catch (e) {
      showToast(e.message || "Error al procesar la imagen", "error");
    } finally {
      setLoading(false);
    }
  }

  function removeItem(id) {
    savePantry(pantry.filter(i => i.id !== id));
    showToast("Ingrediente eliminado");
  }

  const categories = ["all", ...Object.keys(CATEGORIES)];
  const filtered = pantry.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === "all" || item.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="pb-28 animate-fade-in">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Mi Despensa</h1>
        <p className="text-gray-500 text-sm">{pantry.length} ingredientes disponibles</p>
      </div>

      {/* Upload & Add Buttons */}
      <div className="px-5 mb-4 grid grid-cols-2 gap-2">
        <button onClick={() => fileRef.current?.click()} disabled={loading}
          className="press flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-2xl py-3.5 font-bold text-sm shadow-lg shadow-emerald-200">
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Camera className="w-4 h-4" />
          }
          {loading ? "Analizando..." : "Escanear ticket"}
        </button>
        <button onClick={() => setShowAddModal(true)}
          className="press flex items-center justify-center gap-2 bg-white text-gray-700 rounded-2xl py-3.5 font-bold text-sm border border-gray-200 shadow-sm">
          <Plus className="w-4 h-4" /> Agregar manual
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handlePhoto(e.target.files[0])} />
      </div>

      {/* Search */}
      <div className="px-5 mb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ingrediente..."
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="px-5 mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map(cat => {
          const isAll = cat === "all";
          const active = activeCategory === cat;
          const catData = isAll ? null : CATEGORIES[cat];
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`press flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                active ? "bg-emerald-500 text-white" : "bg-white text-gray-600 border border-gray-200"
              }`}>
              {isAll ? "Todos" : catData.label}
            </button>
          );
        })}
      </div>

      {/* Ingredient list */}
      {filtered.length === 0 ? (
        <EmptyPantry hasAny={pantry.length > 0} />
      ) : (
        <div className="px-5 flex flex-col gap-2">
          {filtered.map(item => (
            <PantryCard key={item.id} item={item} onRemove={() => removeItem(item.id)} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddModal onClose={() => setShowAddModal(false)} onAdd={item => {
          savePantry([...pantry, { ...item, id: Date.now() }]);
          setShowAddModal(false);
          showToast("Ingrediente agregado");
        }} />
      )}
    </div>
  );
}

function PantryCard({ item, onRemove }) {
  const cat = CATEGORIES[item.category] || CATEGORIES.otros;
  return (
    <div className="bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bg}`}>
        <span className="text-base">{cat.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs font-medium ${cat.text}`}>{cat.label}</span>
          {item.quantity && (
            <span className="text-xs text-gray-400">· {item.quantity} {item.unit}</span>
          )}
        </div>
      </div>
      <button onClick={onRemove} className="press p-2 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function EmptyPantry({ hasAny }) {
  return (
    <div className="px-5 py-10 flex flex-col items-center text-center gap-3">
      <span className="text-5xl">{hasAny ? "🔍" : "🛒"}</span>
      <p className="font-bold text-gray-700 text-base">
        {hasAny ? "Sin resultados" : "Tu despensa esta vacia"}
      </p>
      <p className="text-gray-400 text-sm max-w-xs">
        {hasAny ? "Proba con otro filtro o busqueda" : "Escanea tu ticket de supermercado para agregar ingredientes automaticamente"}
      </p>
    </div>
  );
}

function AddModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("unidades");
  const [category, setCategory] = useState("otros");

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl p-5 w-full max-w-[500px] animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-gray-900 text-lg">Agregar ingrediente</h3>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100"><X className="w-4 h-4 text-gray-600" /></button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Pechuga de pollo"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Cantidad</label>
              <input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Unidad</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {["unidades","kg","g","l","ml"].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Categoria</label>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(CATEGORIES).map(([id, cat]) => (
                <button key={id} onClick={() => setCategory(id)}
                  className={`press py-2 rounded-xl text-xs font-semibold transition-all ${
                    category === id ? `${cat.bg} ${cat.text} ring-2 ring-offset-1 ring-emerald-400` : "bg-gray-50 text-gray-500"
                  }`}>
                  {cat.icon}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">{CATEGORIES[category]?.label}</p>
          </div>
          <button onClick={() => name && onAdd({ name, quantity, unit, category })} disabled={!name}
            className={`press w-full rounded-2xl py-3.5 font-bold text-sm mt-1 ${name ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"}`}>
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  RECIPES TAB                                                           */
/* ===================================================================== */
function RecipesTab({ profile, pantry, recipes, saveRecipes, savePantry, showToast }) {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("list");
  const [expandedId, setExpandedId] = useState(null);

  async function generateRecipes() {
    if (pantry.length === 0) {
      showToast("Necesitas al menos un ingrediente en tu despensa", "error");
      return;
    }
    setLoading(true);
    try {
      const ingredientsList = pantry.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(", ");
      const result = await callClaude(
        `Sos un chef y nutricionista experto. Crea 3 recetas nutritivas usando los ingredientes disponibles.
         El usuario tiene este perfil: objetivo=${profile?.goal}, restricciones=${profile?.restrictions?.join(",")}, actividad=${profile?.activity}.
         Devuelve SOLO JSON con este formato exacto:
         {"recipes": [{"name": "nombre", "description": "descripcion breve", "time": "30 min", "difficulty": "Facil", "servings": 2, "ingredients": ["500g pollo", "2 tomates"], "steps": ["paso 1", "paso 2"], "macros": {"calorias": 450, "proteinas": 35, "carbohidratos": 40, "grasas": 12}, "tags": ["alto en proteina"]}]}`,
        `Ingredientes disponibles: ${ingredientsList}\n\nCrea 3 recetas variadas, nutritivas y faciles de preparar.`
      );
      const parsed = parseJSON(result);
      if (parsed?.recipes?.length) {
        const newRecipes = parsed.recipes.map(r => ({
          ...r,
          id: Date.now() + Math.random(),
          createdAt: new Date().toISOString(),
          cooked: false,
        }));
        saveRecipes([...newRecipes, ...recipes]);
        showToast(`${newRecipes.length} recetas generadas`);
      } else {
        showToast("No se pudieron generar recetas. Intenta de nuevo.", "error");
      }
    } catch (e) {
      showToast(e.message || "Error al generar recetas", "error");
    } finally {
      setLoading(false);
    }
  }

  function markCooked(recipe) {
    const updated = recipes.map(r =>
      r.id === recipe.id ? { ...r, cooked: true, cookedAt: new Date().toISOString() } : r
    );
    saveRecipes(updated);
    showToast(`${recipe.name} cocinada!`);
  }

  const currentRecipes = recipes.filter(r => !r.cooked);
  const historyRecipes = recipes.filter(r => r.cooked);

  return (
    <div className="pb-28 animate-fade-in">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Recetas</h1>
        <p className="text-gray-500 text-sm">Generadas especialmente para vos</p>
      </div>

      {/* Generate Button */}
      <div className="px-5 mb-4">
        <button onClick={generateRecipes} disabled={loading}
          className="press w-full bg-emerald-500 text-white rounded-2xl py-4 font-bold text-base shadow-lg shadow-emerald-200 flex items-center justify-center gap-2">
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Generando recetas...</>
            : <><Sparkles className="w-5 h-5" /> Generar recetas con IA</>
          }
        </button>
        {pantry.length > 0 && !loading && (
          <p className="text-center text-gray-400 text-xs mt-2">
            Usando {pantry.length} ingredientes de tu despensa
          </p>
        )}
      </div>

      {/* Toggle */}
      {(currentRecipes.length > 0 || historyRecipes.length > 0) && (
        <div className="px-5 mb-4">
          <div className="bg-gray-100 rounded-2xl p-1 flex">
            {[
              { id: "list", label: `Para cocinar (${currentRecipes.length})` },
              { id: "history", label: `Cocinadas (${historyRecipes.length})` },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`press flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  view === v.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recipe List */}
      <div className="px-5 flex flex-col gap-3">
        {(view === "list" ? currentRecipes : historyRecipes).map(recipe => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            expanded={expandedId === recipe.id}
            onToggle={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
            onCook={() => markCooked(recipe)}
          />
        ))}
        {view === "list" && currentRecipes.length === 0 && (
          <EmptyRecipes />
        )}
        {view === "history" && historyRecipes.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-4xl mb-3">🍽</p>
            <p className="font-bold text-gray-700">Aun no cocinaste nada</p>
            <p className="text-gray-400 text-sm mt-1">Cuando marques una receta como cocinada, aparecera aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeCard({ recipe, expanded, onToggle, onCook }) {
  const difficultyColor = {
    "Facil": "text-emerald-600 bg-emerald-50",
    "Fácil": "text-emerald-600 bg-emerald-50",
    "Medio": "text-amber-600 bg-amber-50",
    "Dificil": "text-red-500 bg-red-50",
    "Difícil": "text-red-500 bg-red-50",
  };
  const dc = difficultyColor[recipe.difficulty] || "text-emerald-600 bg-emerald-50";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-4 press">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {recipe.cooked && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              <h3 className="font-bold text-gray-900 text-base leading-tight">{recipe.name}</h3>
            </div>
            <p className="text-gray-500 text-sm line-clamp-2">{recipe.description}</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <Clock className="w-3.5 h-3.5" />{recipe.time}
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dc}`}>{recipe.difficulty}</span>
              {recipe.macros && (
                <span className="text-xs text-gray-400">{recipe.macros.calorias} kcal</span>
              )}
            </div>
          </div>
          <ChevronRight className={`w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 animate-slide-up">
          {/* Macros */}
          {recipe.macros && (
            <div className="pt-3 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Informacion nutricional</p>
              <MacrosBar macros={recipe.macros} />
            </div>
          )}

          {/* Ingredients */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredientes</p>
            <div className="flex flex-wrap gap-1.5">
              {recipe.ingredients?.map((ing, i) => (
                <span key={i} className="bg-gray-50 border border-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full font-medium">
                  {ing}
                </span>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preparacion</p>
            <ol className="flex flex-col gap-2">
              {recipe.steps?.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-6 h-6 bg-emerald-500 text-white rounded-full text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {!recipe.cooked && (
            <button onClick={onCook}
              className="press w-full bg-emerald-500 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Marcar como cocinada
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MacrosBar({ macros }) {
  const total = (macros.proteinas || 0) * 4 + (macros.carbohidratos || 0) * 4 + (macros.grasas || 0) * 9;
  const pProt  = total > 0 ? Math.round(((macros.proteinas || 0) * 4 / total) * 100) : 33;
  const pCarb  = total > 0 ? Math.round(((macros.carbohidratos || 0) * 4 / total) * 100) : 33;
  const pGrasa = Math.max(100 - pProt - pCarb, 2);

  return (
    <div>
      <div className="flex items-center gap-1 mb-2 h-2.5">
        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pProt}%` }} />
        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pCarb}%` }} />
        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pGrasa}%` }} />
      </div>
      <div className="flex gap-4">
        {[
          { label: "Proteinas", value: macros.proteinas, unit: "g", color: "text-blue-500" },
          { label: "Carbos",    value: macros.carbohidratos, unit: "g", color: "text-amber-500" },
          { label: "Grasas",   value: macros.grasas, unit: "g", color: "text-orange-500" },
        ].map((m, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className={`text-xs font-bold ${m.color}`}>{m.value}{m.unit}</span>
            <span className="text-xs text-gray-400">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyRecipes() {
  return (
    <div className="py-10 flex flex-col items-center text-center gap-3">
      <span className="text-5xl">🍴</span>
      <p className="font-bold text-gray-700 text-base">Sin recetas aun</p>
      <p className="text-gray-400 text-sm max-w-xs">
        Carga ingredientes en tu despensa y genera recetas personalizadas con IA
      </p>
    </div>
  );
}

/* ===================================================================== */
/*  PROFILE TAB                                                           */
/* ===================================================================== */
function ProfileTab({ profile, saveProfile, showToast }) {
  const [editing, setEditing] = useState(false);
  const photoInput = useRef(null);

  async function handleAvatar(file) {
    if (!file) return;
    try {
      const photo = await fileToAvatar(file);
      saveProfile({ ...profile, photo });
      showToast("Foto actualizada");
    } catch {
      showToast("No se pudo cargar la foto", "error");
    }
  }

  if (editing) {
    return (
      <EditProfile
        profile={profile}
        onSave={p => { saveProfile(p); setEditing(false); showToast("Perfil actualizado"); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const goalData     = GOALS.find(g => g.id === profile?.goal);
  const activityData = ACTIVITY.find(a => a.id === profile?.activity);
  const trainingData = TRAINING.find(t => t.id === profile?.training);

  return (
    <div className="pb-28 animate-fade-in">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Mi Perfil</h1>
        <p className="text-gray-500 text-sm">Tu informacion personal</p>
      </div>

      {/* Profile Hero Card */}
      <div className="mx-5 mb-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-5 text-white shadow-xl shadow-emerald-200">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => photoInput.current?.click()} aria-label="Cambiar foto de perfil"
            className="press relative w-20 h-20 shrink-0">
            <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center text-4xl overflow-hidden ring-2 ring-white/40">
              {profile?.photo
                ? <img src={profile.photo} alt="Foto de perfil" className="w-full h-full object-cover" />
                : (profile?.gender === "femenino" ? "👩" : "👨")}
            </div>
            <span className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
              <Camera className="w-4 h-4 text-emerald-600" />
            </span>
          </button>
          <input ref={photoInput} type="file" accept="image/*" className="hidden"
            onChange={e => { handleAvatar(e.target.files[0]); e.target.value = ""; }} />
          <div>
            <h2 className="text-xl font-extrabold">{profile?.name}</h2>
            <p className="text-emerald-100 text-sm">{profile?.age} años · {profile?.weight}kg · {profile?.height}cm</p>
            {profile?.photo && (
              <button onClick={() => { saveProfile({ ...profile, photo: null }); showToast("Foto eliminada"); }}
                className="text-xs text-emerald-100/80 underline mt-1">Quitar foto</button>
            )}
          </div>
        </div>
        {goalData && (
          <div className="mt-4 bg-white/15 rounded-2xl p-3 flex items-center gap-3">
            <span className="text-2xl">{goalData.icon}</span>
            <div>
              <p className="text-xs text-emerald-100">Objetivo</p>
              <p className="font-bold text-sm">{goalData.label}</p>
            </div>
          </div>
        )}
      </div>

      {/* Info Sections */}
      <div className="px-5 flex flex-col gap-3 mb-4">
        <ProfileSection title="Actividad fisica">
          <ProfileRow label="Nivel de actividad" value={activityData?.label || "—"} />
          <ProfileRow label="Entrenamiento" value={trainingData ? `${trainingData.icon} ${trainingData.label}` : "—"} />
        </ProfileSection>

        <ProfileSection title="Alimentacion">
          <ProfileRow
            label="Restricciones"
            value={
              profile?.restrictions?.length > 0
                ? profile.restrictions.map(r => RESTRICTIONS.find(x => x.id === r)?.label).filter(Boolean).join(", ")
                : "Ninguna"
            }
          />
        </ProfileSection>
      </div>

      <div className="px-5">
        <button onClick={() => setEditing(true)}
          className="press w-full bg-white border border-gray-200 text-gray-700 rounded-2xl py-4 font-bold text-base shadow-sm">
          Editar perfil
        </button>
      </div>
    </div>
  );
}

function ProfileSection({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

function ProfileRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function EditProfile({ profile, onSave, onCancel }) {
  const [local, setLocal] = useState({ ...profile });

  return (
    <div className="pb-28 animate-fade-in">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button onClick={onCancel} className="p-2 rounded-full bg-gray-100 press">
          <X className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-extrabold text-gray-900">Editar perfil</h1>
      </div>

      <div className="px-5 flex flex-col gap-4">
        <OnboardingField label="Nombre" value={local.name} onChange={v => setLocal(d=>({...d,name:v}))} placeholder="Tu nombre" />
        <OnboardingField label="Edad" type="number" value={local.age} onChange={v => setLocal(d=>({...d,age:v}))} suffix="años" />
        <div className="grid grid-cols-2 gap-3">
          <OnboardingField label="Peso" type="number" value={local.weight} onChange={v => setLocal(d=>({...d,weight:v}))} suffix="kg" />
          <OnboardingField label="Altura" type="number" value={local.height} onChange={v => setLocal(d=>({...d,height:v}))} suffix="cm" />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">Objetivo</label>
          <div className="flex flex-col gap-2">
            {GOALS.map(g => (
              <button key={g.id} onClick={() => setLocal(d=>({...d,goal:g.id}))}
                className={`press flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${
                  local.goal === g.id ? "border-emerald-500 bg-emerald-50" : "border-gray-100 bg-gray-50"
                }`}>
                <span className="text-xl">{g.icon}</span>
                <span className={`font-semibold text-sm flex-1 ${local.goal === g.id ? "text-emerald-700" : "text-gray-700"}`}>{g.label}</span>
                {local.goal === g.id && <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => onSave(local)}
          className="press w-full bg-emerald-500 text-white rounded-2xl py-4 font-bold text-base shadow-lg shadow-emerald-200">
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  TAB BAR                                                               */
/* ===================================================================== */
function TabBar({ tab, setTab }) {
  const tabs = [
    { id: "home",    icon: Home,        label: "Inicio" },
    { id: "pantry",  icon: ShoppingBag, label: "Despensa" },
    { id: "recipes", icon: ChefHat,     label: "Recetas" },
    { id: "profile", icon: User,        label: "Perfil" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="mx-auto max-w-[500px] px-4 pb-6 pt-2">
        <div className="bg-white border border-gray-200 rounded-[28px] shadow-2xl p-1.5 flex">
          {tabs.map(t => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`press relative flex-1 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                  active ? "text-white" : "text-gray-400"
                }`}>
                {active && (
                  <span className="absolute inset-0 rounded-2xl bg-emerald-500 animate-pop-in" />
                )}
                <Icon className="w-5 h-5 relative" strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-bold relative tracking-wide">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  TOAST                                                                 */
/* ===================================================================== */
function Toast({ toast }) {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-pop-in">
      <div className={`px-5 h-12 rounded-full flex items-center gap-2.5 shadow-xl ${
        toast.type === "error" ? "bg-red-500 text-white" : "bg-gray-900 text-white"
      }`}>
        {toast.type === "error"
          ? <XCircle className="w-4 h-4" />
          : <CheckCircle className="w-4 h-4 text-emerald-400" />
        }
        <span className="text-sm font-semibold">{toast.text}</span>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  UTILS                                                                 */
/* ===================================================================== */
function fileToAvatar(file, size = 256) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onerror = () => rej(new Error("Read failed"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => rej(new Error("Image load failed"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
        res(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const MAX_PX = 1200;
    const QUALITY = 0.82;
    const reader = new FileReader();
    reader.onerror = () => rej(new Error("Read failed"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => rej(new Error("Image load failed"));
      img.onload = () => {
        const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
        res(dataUrl.split(",")[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
