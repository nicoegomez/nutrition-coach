import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Package, ChefHat, User, Upload, Camera, Sparkles, Plus,
  Minus, Trash2, Check, ArrowRight, ArrowLeft, Clock, Flame,
  Target, Leaf, Apple, Beef, Wheat, Milk, Droplet, Carrot,
  Activity, Loader2, RefreshCw, X, ChevronRight, Scale, Moon,
  Briefcase, Dumbbell, Utensils, Heart, AlertCircle, Check as CheckIcon,
  Sparkle, TrendingUp, BookOpen
} from "lucide-react";

/* =========================================================================
   COACH — Personal Nutrition Coach
   Single-file React artifact · Mobile-first · Claude-in-Claude powered
   ========================================================================= */

// ---------- Claude API helper ----------
// Works in Claude.ai artifacts (no key needed) and standalone deploy (env var)
const callClaude = async (messages, { maxTokens = 1000 } = {}) => {
  const apiKey = (typeof process !== "undefined" && process.env && process.env.REACT_APP_ANTHROPIC_KEY) || null;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-calls"] = "true";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => String(res.status));
    throw new Error(`API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
};

const parseJSON = (text) => {
  const clean = text.replace(/```json|```/g, "").trim();
  const firstBrace = Math.min(
    ...["{", "["].map((c) => {
      const i = clean.indexOf(c);
      return i === -1 ? Infinity : i;
    })
  );
  const lastBrace = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
  const sliced = clean.slice(firstBrace, lastBrace + 1);
  return JSON.parse(sliced);
};

// ---------- Storage helpers (localStorage for PWA) ----------
const storage = {
  async get(key, fallback) {
    try {
      // Try window.storage first (Claude artifacts), fall back to localStorage
      if (window.storage && typeof window.storage.get === 'function') {
        const r = await window.storage.get(key);
        return r ? JSON.parse(r.value) : fallback;
      }
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  async set(key, value) {
    try {
      if (window.storage && typeof window.storage.set === 'function') {
        await window.storage.set(key, JSON.stringify(value));
        return;
      }
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('storage.set', e);
    }
  },
};

// ---------- Category config ----------
const CATEGORIES = {
  proteina:     { label: "Proteína",    icon: Beef,    color: "rose",    bg: "bg-rose-50",    text: "text-rose-700",    ring: "ring-rose-100" },
  carbohidrato: { label: "Carbohidrato",icon: Wheat,   color: "amber",   bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-100" },
  verdura:      { label: "Verdura",     icon: Carrot,  color: "emerald", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100" },
  fruta:        { label: "Fruta",       icon: Apple,   color: "pink",    bg: "bg-pink-50",    text: "text-pink-700",    ring: "ring-pink-100" },
  lacteo:       { label: "Lácteo",      icon: Milk,    color: "sky",     bg: "bg-sky-50",     text: "text-sky-700",     ring: "ring-sky-100" },
  grasa:        { label: "Grasa",       icon: Droplet, color: "yellow",  bg: "bg-yellow-50",  text: "text-yellow-800",  ring: "ring-yellow-100" },
  otros:        { label: "Otros",       icon: Leaf,    color: "stone",   bg: "bg-stone-100",  text: "text-stone-700",   ring: "ring-stone-200" },
};
const catOf = (c) => CATEGORIES[c] || CATEGORIES.otros;

// ---------- Onboarding steps ----------
const ACTIVITY = [
  { id: "sedentario", label: "Sedentario", desc: "Trabajo de oficina, poco movimiento" },
  { id: "ligero",     label: "Ligero",     desc: "Camino a diario, algo de ejercicio" },
  { id: "moderado",   label: "Moderado",   desc: "Entreno 3–4 veces por semana" },
  { id: "intenso",    label: "Intenso",    desc: "Entreno 5+ veces, alto volumen" },
];
const TRAINING = [
  { id: "fuerza",   label: "Fuerza" },
  { id: "cardio",   label: "Cardio" },
  { id: "hibrido",  label: "Híbrido" },
  { id: "deporte",  label: "Deporte específico" },
];
const GOALS = [
  { id: "perder_grasa",    label: "Perder grasa",         icon: TrendingUp },
  { id: "ganar_musculo",   label: "Ganar músculo",        icon: Dumbbell },
  { id: "recomposicion",   label: "Recomposición",        icon: Activity },
  { id: "rendimiento",     label: "Rendimiento deportivo",icon: Target },
  { id: "salud",           label: "Salud general",        icon: Heart },
];
const RESTRICTIONS = [
  "Sin gluten", "Sin lactosa", "Vegetariano", "Vegano", "Pescetariano",
  "Sin frutos secos", "Sin mariscos", "Sin huevo", "Halal", "Kosher",
];

// =====================================================================
//  MAIN APP
// =====================================================================
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("home");
  const [profile, setProfile] = useState(null);
  const [pantry, setPantry] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [recipeHistory, setRecipeHistory] = useState([]);
  const [ticketHistory, setTicketHistory] = useState([]);
  const [toast, setToast] = useState(null);

  // Boot
  useEffect(() => {
    (async () => {
      const [p, pt, rh, th] = await Promise.all([
        storage.get("profile:user", null),
        storage.get("pantry:items", []),
        storage.get("history:recipes", []),
        storage.get("history:tickets", []),
      ]);
      setProfile(p);
      setPantry(pt);
      setRecipeHistory(rh);
      setTicketHistory(th);
      setLoaded(true);
    })();
  }, []);

  // Persist helpers
  const saveProfile = useCallback(async (p) => {
    setProfile(p);
    await storage.set("profile:user", p);
  }, []);
  const savePantry = useCallback(async (items) => {
    setPantry(items);
    await storage.set("pantry:items", items);
  }, []);
  const saveRecipeHistory = useCallback(async (h) => {
    setRecipeHistory(h);
    await storage.set("history:recipes", h);
  }, []);
  const saveTicketHistory = useCallback(async (h) => {
    setTicketHistory(h);
    await storage.set("history:tickets", h);
  }, []);

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 2600);
  };

  if (!loaded) return <BootScreen />;
  if (!profile) return <Onboarding onComplete={saveProfile} />;

  return (
    <div className="min-h-screen w-full bg-appbg text-stone-900 font-sans antialiased">
      <GlobalStyles />
      <div className="mx-auto w-full max-w-[900px] min-h-screen relative pb-28">
        {/* Top grain / warmth */}
        <div className="pointer-events-none fixed inset-0 opacity-[0.035] mix-blend-multiply"
             style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }} />

        <div key={tab} className="animate-fade-in">
          {tab === "home" && (
            <HomeTab
              profile={profile}
              pantry={pantry}
              recipeHistory={recipeHistory}
              onGoto={setTab}
              onToast={showToast}
              pantrySet={savePantry}
              ticketHistory={ticketHistory}
              saveTicketHistory={saveTicketHistory}
            />
          )}
          {tab === "pantry" && (
            <PantryTab
              pantry={pantry}
              savePantry={savePantry}
              onToast={showToast}
              saveTicketHistory={saveTicketHistory}
              ticketHistory={ticketHistory}
            />
          )}
          {tab === "recipes" && (
            <RecipesTab
              profile={profile}
              pantry={pantry}
              savePantry={savePantry}
              recipes={recipes}
              setRecipes={setRecipes}
              recipeHistory={recipeHistory}
              saveRecipeHistory={saveRecipeHistory}
              onToast={showToast}
            />
          )}
          {tab === "profile" && (
            <ProfileTab profile={profile} saveProfile={saveProfile} onToast={showToast} />
          )}
        </div>

        <TabBar tab={tab} setTab={setTab} />
        {toast && <Toast toast={toast} />}
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  GLOBAL STYLES                                                        */
/* ===================================================================== */
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Manrope:wght@400;500;600;700&display=swap');
      :root{
        --bg:#faf7f2;
        --ink:#1c1a17;
        --moss:#3d5a40;
        --moss-deep:#2a4030;
        --sage:#8aa785;
        --cream:#f3ede2;
        --terra:#c96f4a;
        --terra-soft:#e9a988;
        --amber:#d98f3c;
      }
      html, body, #root { background: #faf7f2; }
      .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
      .font-sans { font-family: 'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif; }

      /* Brand color utilities — robust, independent of Tailwind JIT */
      .bg-moss { background-color: #3d5a40 !important; }
      .bg-moss-deep { background-color: #2a4030 !important; }
      .bg-sage { background-color: #8aa785 !important; }
      .bg-cream { background-color: #f3ede2 !important; }
      .bg-cream-60 { background-color: rgba(243, 237, 226, 0.6) !important; }
      .bg-terra { background-color: #c96f4a !important; }
      .bg-terra-10 { background-color: rgba(201, 111, 74, 0.1) !important; }
      .bg-terra-20 { background-color: rgba(201, 111, 74, 0.2) !important; }
      .bg-terra-25 { background-color: rgba(201, 111, 74, 0.25) !important; }
      .bg-terra-soft { background-color: #e9a988 !important; }
      .bg-sage-20 { background-color: rgba(138, 167, 133, 0.2) !important; }
      .bg-sage-25 { background-color: rgba(138, 167, 133, 0.25) !important; }
      .bg-sage-30 { background-color: rgba(138, 167, 133, 0.3) !important; }
      .bg-appbg { background-color: #faf7f2 !important; }
      .text-moss { color: #3d5a40 !important; }
      .text-sage { color: #8aa785 !important; }
      .text-terra { color: #c96f4a !important; }
      .ring-moss { --tw-ring-color: #3d5a40; box-shadow: inset 0 0 0 1px #3d5a40; }
      .ring-moss-2 { --tw-ring-color: #3d5a40; box-shadow: 0 0 0 2px #3d5a40; }
      .hover\\:ring-moss:hover { box-shadow: inset 0 0 0 1px #3d5a40; }
      .hover\\:bg-cream:hover { background-color: #f3ede2 !important; }
      .focus\\:ring-moss-2:focus { box-shadow: 0 0 0 2px #3d5a40; outline: none; }

      @keyframes fade-in { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: none;} }
      .animate-fade-in { animation: fade-in .45s cubic-bezier(.2,.7,.2,1) both; }
      @keyframes pop-in { from { opacity: 0; transform: scale(.94);} to { opacity: 1; transform: scale(1);} }
      .animate-pop-in { animation: pop-in .35s cubic-bezier(.2,.7,.2,1) both; }
      @keyframes slide-up { from { opacity: 0; transform: translateY(14px);} to { opacity: 1; transform: none;} }
      .animate-slide-up { animation: slide-up .5s cubic-bezier(.2,.7,.2,1) both; }
      @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
      .shimmer { background: linear-gradient(90deg, #ece6db 0%, #f5f1e8 40%, #ece6db 80%); background-size: 800px 100%; animation: shimmer 1.4s linear infinite; }
      @keyframes spin-slow { to { transform: rotate(360deg); } }
      .spin-slow { animation: spin-slow 2.6s linear infinite; }
      @keyframes breathe { 0%,100% { transform: scale(1);} 50% { transform: scale(1.04);} }
      .breathe { animation: breathe 3.2s ease-in-out infinite; }
      .stagger > * { opacity: 0; animation: slide-up .55s cubic-bezier(.2,.7,.2,1) forwards; }
      .stagger > *:nth-child(1){ animation-delay: .05s }
      .stagger > *:nth-child(2){ animation-delay: .12s }
      .stagger > *:nth-child(3){ animation-delay: .19s }
      .stagger > *:nth-child(4){ animation-delay: .26s }
      .stagger > *:nth-child(5){ animation-delay: .33s }
      .stagger > *:nth-child(6){ animation-delay: .40s }
      .stagger > *:nth-child(7){ animation-delay: .47s }
      .stagger > *:nth-child(8){ animation-delay: .54s }
      .stagger > *:nth-child(9){ animation-delay: .61s }
      .no-scrollbar::-webkit-scrollbar{display:none}
      .no-scrollbar{scrollbar-width:none}
      .press:active { transform: scale(.97); }
      .press { transition: transform .15s cubic-bezier(.2,.7,.2,1), box-shadow .2s, background-color .2s, border-color .2s; }
    `}</style>
  );
}

/* ===================================================================== */
/*  BOOT SCREEN                                                          */
/* ===================================================================== */
function BootScreen() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-appbg">
      <GlobalStyles />
      <div className="flex flex-col items-center gap-4 breathe">
        <LogoMark size={56} />
        <span className="font-display text-2xl text-stone-800">coach</span>
      </div>
    </div>
  );
}

function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="#3d5a40" />
      <path d="M24 10c-5 4-8 8-8 14 0 5 3.5 9 8 9s8-4 8-9c0-6-3-10-8-14z" fill="#8aa785" />
      <path d="M24 10v23" stroke="#f3ede2" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="33" cy="14" r="3.5" fill="#c96f4a" />
    </svg>
  );
}

/* ===================================================================== */
/*  ONBOARDING                                                           */
/* ===================================================================== */
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: "",
    age: "",
    weight: "",
    height: "",
    activity: "",
    sleep: "",
    profession: "",
    training: "",
    frequency: "",
    duration: "",
    timeOfDay: "",
    goals: [],
    goalNotes: "",
    restrictions: [],
    allergies: "",
  });

  const steps = [
    { key: "welcome", title: "Bienvenido" },
    { key: "basics",  title: "Sobre ti" },
    { key: "lifestyle", title: "Estilo de vida" },
    { key: "training", title: "Entrenamiento" },
    { key: "goals", title: "Objetivos" },
    { key: "restrictions", title: "Restricciones" },
    { key: "done", title: "Listo" },
  ];
  const total = steps.length;
  const progress = ((step) / (total - 1)) * 100;

  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = () => {
    switch (steps[step].key) {
      case "welcome": return true;
      case "basics": return data.name.trim() && data.age && data.weight && data.height;
      case "lifestyle": return data.activity && data.sleep;
      case "training": return data.training && data.frequency;
      case "goals": return data.goals.length > 0;
      case "restrictions": return true;
      default: return true;
    }
  };

  const finish = () => onComplete({ ...data, createdAt: Date.now() });

  return (
    <div className="min-h-screen w-full bg-appbg flex flex-col">
      <GlobalStyles />
      <div className="mx-auto w-full max-w-[900px] flex-1 flex flex-col px-5 pt-10 pb-8">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          {step > 0 && step < total - 1 && (
            <button onClick={back} className="press p-2 -ml-2 rounded-full hover:bg-stone-200">
              <ArrowLeft className="w-5 h-5 text-stone-600" />
            </button>
          )}
          <div className="flex-1 h-1.5 bg-stone-200/70 rounded-full overflow-hidden">
            <div className="h-full bg-moss rounded-full transition-all duration-500 ease-out"
                 style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-medium text-stone-500 tabular-nums">{step + 1}/{total}</span>
        </div>

        <div key={step} className="flex-1 animate-slide-up">
          {steps[step].key === "welcome"    && <StepWelcome onNext={next} />}
          {steps[step].key === "basics"     && <StepBasics data={data} setData={setData} />}
          {steps[step].key === "lifestyle"  && <StepLifestyle data={data} setData={setData} />}
          {steps[step].key === "training"   && <StepTraining data={data} setData={setData} />}
          {steps[step].key === "goals"      && <StepGoals data={data} setData={setData} />}
          {steps[step].key === "restrictions" && <StepRestrictions data={data} setData={setData} />}
          {steps[step].key === "done"       && <StepDone data={data} onFinish={finish} />}
        </div>

        {steps[step].key !== "welcome" && steps[step].key !== "done" && (
          <button
            disabled={!canNext()}
            onClick={next}
            className="press mt-6 w-full h-14 rounded-2xl bg-moss text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_24px_-8px_rgba(61,90,64,0.5)]"
          >
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function StepWelcome({ onNext }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 pt-6">
      <div className="relative">
        <div className="absolute inset-0 blur-3xl bg-emerald-200/40 rounded-full" />
        <div className="relative breathe"><LogoMark size={96} /></div>
      </div>
      <div className="space-y-3">
        <h1 className="font-display text-5xl font-semibold text-stone-900 leading-[1.05]">
          Tu coach<br/>nutricional<br/>
          <em className="text-moss not-italic font-display font-light italic">personal.</em>
        </h1>
        <p className="text-stone-600 max-w-sm mx-auto text-[15px] leading-relaxed">
          Sube tus tickets, conviértelos en despensa y recibe recetas que encajan con tu objetivo y lo que ya tienes en casa.
        </p>
      </div>
      <ul className="stagger space-y-3 text-left mt-2 w-full max-w-sm">
        {[
          { icon: Camera, t: "Foto al ticket", d: "Tu despensa se actualiza sola" },
          { icon: ChefHat, t: "Recetas a medida", d: "Con lo que tienes, para tu objetivo" },
          { icon: Sparkle, t: "Aprende contigo", d: "Cuanto más lo usas, mejor te conoce" },
        ].map(({ icon: Icon, t, d }) => (
          <li key={t} className="flex items-start gap-3 p-3 rounded-2xl bg-white ring-1 ring-stone-200/70">
            <div className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-moss" />
            </div>
            <div>
              <div className="font-semibold text-sm">{t}</div>
              <div className="text-xs text-stone-500">{d}</div>
            </div>
          </li>
        ))}
      </ul>
      <button onClick={onNext}
        className="press mt-4 w-full max-w-sm h-14 rounded-2xl bg-moss text-white font-semibold flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(61,90,64,0.5)]">
        Empezar <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function StepHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-3xl font-semibold text-stone-900 leading-tight">{title}</h2>
      {subtitle && <p className="text-stone-500 text-[15px] mt-1">{subtitle}</p>}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">{label}</span>
      {children}
      {hint && <span className="block text-xs text-stone-400 mt-1.5">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full h-12 px-4 rounded-xl bg-white ring-1 ring-stone-200 focus:ring-2 focus:ring-moss focus:outline-none transition-all text-stone-900 placeholder:text-stone-400";

function StepBasics({ data, setData }) {
  return (
    <div className="animate-slide-up">
      <StepHeader title="Háblanos de ti" subtitle="Usamos esto solo para calibrar tus recetas." />
      <div className="space-y-4">
        <Field label="Nombre">
          <input value={data.name} onChange={e => setData({...data, name: e.target.value})}
            placeholder="¿Cómo te llamamos?" className={inputCls} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Edad">
            <input type="number" inputMode="numeric" value={data.age} onChange={e => setData({...data, age: e.target.value})}
              placeholder="28" className={inputCls} />
          </Field>
          <Field label="Peso (kg)">
            <input type="number" inputMode="decimal" value={data.weight} onChange={e => setData({...data, weight: e.target.value})}
              placeholder="72" className={inputCls} />
          </Field>
          <Field label="Altura (cm)">
            <input type="number" inputMode="numeric" value={data.height} onChange={e => setData({...data, height: e.target.value})}
              placeholder="178" className={inputCls} />
          </Field>
        </div>
        <Field label="Profesión" hint="Opcional — nos ayuda a entender tu día">
          <input value={data.profession} onChange={e => setData({...data, profession: e.target.value})}
            placeholder="Ej. diseñador, enfermera, comercial…" className={inputCls} />
        </Field>
      </div>
    </div>
  );
}

function StepLifestyle({ data, setData }) {
  return (
    <div className="animate-slide-up">
      <StepHeader title="Tu día a día" subtitle="¿Cuánto te mueves y cómo descansas?" />
      <Field label="Actividad diaria">
        <div className="space-y-2">
          {ACTIVITY.map(a => (
            <button key={a.id}
              onClick={() => setData({...data, activity: a.id})}
              className={`press w-full p-4 rounded-2xl text-left ring-1 flex items-start gap-3 ${
                data.activity === a.id
                  ? "bg-moss text-white ring-moss"
                  : "bg-white text-stone-900 ring-stone-200 hover:ring-stone-300"
              }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                data.activity === a.id ? "bg-white/15" : "bg-stone-100"
              }`}>
                <Activity className={`w-4 h-4 ${data.activity === a.id ? "text-white" : "text-stone-500"}`} />
              </div>
              <div>
                <div className="font-semibold text-sm">{a.label}</div>
                <div className={`text-xs mt-0.5 ${data.activity === a.id ? "text-white/80" : "text-stone-500"}`}>{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Field>
      <div className="mt-4">
        <Field label="Horas de sueño (media)">
          <div className="flex items-center gap-3 bg-white ring-1 ring-stone-200 rounded-xl p-3">
            <Moon className="w-5 h-5 text-stone-400" />
            <input type="number" inputMode="decimal" value={data.sleep} onChange={e => setData({...data, sleep: e.target.value})}
              placeholder="7.5" className="flex-1 outline-none bg-transparent text-stone-900 placeholder:text-stone-400" />
            <span className="text-sm text-stone-400">h</span>
          </div>
        </Field>
      </div>
    </div>
  );
}

function StepTraining({ data, setData }) {
  return (
    <div className="animate-slide-up">
      <StepHeader title="Cómo entrenas" subtitle="Para afinar kcal y macros." />
      <Field label="Tipo de entrenamiento">
        <div className="grid grid-cols-2 gap-2">
          {TRAINING.map(t => (
            <button key={t.id} onClick={() => setData({...data, training: t.id})}
              className={`press p-4 rounded-2xl text-center font-semibold text-sm ring-1 ${
                data.training === t.id
                  ? "bg-moss text-white ring-moss"
                  : "bg-white text-stone-900 ring-stone-200 hover:ring-stone-300"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field label="Sesiones / semana">
          <input type="number" inputMode="numeric" value={data.frequency}
            onChange={e => setData({...data, frequency: e.target.value})}
            placeholder="4" className={inputCls} />
        </Field>
        <Field label="Minutos por sesión">
          <input type="number" inputMode="numeric" value={data.duration}
            onChange={e => setData({...data, duration: e.target.value})}
            placeholder="60" className={inputCls} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Momento del día">
          <div className="grid grid-cols-3 gap-2">
            {["Mañana","Tarde","Noche"].map(m => (
              <button key={m} onClick={() => setData({...data, timeOfDay: m})}
                className={`press p-3 rounded-xl text-sm font-medium ring-1 ${
                  data.timeOfDay === m
                    ? "bg-stone-900 text-white ring-stone-900"
                    : "bg-white text-stone-900 ring-stone-200 hover:ring-stone-300"
                }`}>{m}</button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

function StepGoals({ data, setData }) {
  const toggle = (id) => {
    const has = data.goals.includes(id);
    setData({...data, goals: has ? data.goals.filter(g => g !== id) : [...data.goals, id]});
  };
  return (
    <div className="animate-slide-up">
      <StepHeader title="Tus objetivos" subtitle="Elige uno o varios. Sin prisa." />
      <div className="grid grid-cols-2 gap-2 mb-4">
        {GOALS.map(g => {
          const Icon = g.icon;
          const active = data.goals.includes(g.id);
          return (
            <button key={g.id} onClick={() => toggle(g.id)}
              className={`press p-4 rounded-2xl text-left ring-1 ${
                active ? "bg-moss text-white ring-moss" : "bg-white text-stone-900 ring-stone-200 hover:ring-stone-300"
              }`}>
              <Icon className={`w-5 h-5 mb-2 ${active ? "text-white" : "text-moss"}`} />
              <div className="font-semibold text-sm leading-tight">{g.label}</div>
            </button>
          );
        })}
      </div>
      <Field label="Algo más que debamos saber" hint="Opcional — ej. eventos próximos, lesiones, preferencias fuertes">
        <textarea value={data.goalNotes} onChange={e => setData({...data, goalNotes: e.target.value})}
          placeholder="Ej. competición en 3 meses, odio el brócoli, me cuesta desayunar…"
          className={`${inputCls} h-24 py-3 resize-none`} />
      </Field>
    </div>
  );
}

function StepRestrictions({ data, setData }) {
  const toggle = (r) => {
    const has = data.restrictions.includes(r);
    setData({...data, restrictions: has ? data.restrictions.filter(x => x !== r) : [...data.restrictions, r]});
  };
  return (
    <div className="animate-slide-up">
      <StepHeader title="Restricciones" subtitle="Todo lo que debamos evitar." />
      <Field label="Toca las que apliquen">
        <div className="flex flex-wrap gap-2">
          {RESTRICTIONS.map(r => {
            const active = data.restrictions.includes(r);
            return (
              <button key={r} onClick={() => toggle(r)}
                className={`press px-4 h-10 rounded-full text-sm font-medium ring-1 ${
                  active ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-900 ring-stone-200 hover:ring-stone-300"
                }`}>{r}</button>
            );
          })}
        </div>
      </Field>
      <div className="mt-4">
        <Field label="Alergias o notas extra" hint="Opcional">
          <textarea value={data.allergies} onChange={e => setData({...data, allergies: e.target.value})}
            placeholder="Ej. alergia a cacahuetes, intolerancia moderada a la lactosa…"
            className={`${inputCls} h-20 py-3 resize-none`} />
        </Field>
      </div>
    </div>
  );
}

function StepDone({ data, onFinish }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 pt-10 animate-slide-up">
      <div className="relative">
        <div className="absolute inset-0 blur-2xl bg-emerald-300/50 rounded-full" />
        <div className="relative w-24 h-24 rounded-full bg-moss flex items-center justify-center shadow-xl breathe">
          <CheckIcon className="w-12 h-12 text-white" strokeWidth={2.5} />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="font-display text-4xl font-semibold">Listo, {data.name || "chef"}.</h2>
        <p className="text-stone-600 max-w-sm text-[15px]">
          Tu perfil está configurado. Empieza subiendo un ticket de compra o pidiendo tu primera receta.
        </p>
      </div>
      <button onClick={onFinish}
        className="press w-full max-w-sm h-14 rounded-2xl bg-moss text-white font-semibold shadow-[0_8px_24px_-8px_rgba(61,90,64,0.5)] flex items-center justify-center gap-2">
        Entrar a la app <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ===================================================================== */
/*  HOME                                                                  */
/* ===================================================================== */
function HomeTab({ profile, pantry, recipeHistory, onGoto, onToast, pantrySet, ticketHistory, saveTicketHistory }) {
  const [uploading, setUploading] = useState(false);
  const [ticketStatus, setTicketStatus] = useState(null);
  const fileRef = useRef();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return "Buenas noches";
    if (h < 12) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  })();

  const pantryByCat = pantry.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});
  const topCats = Object.entries(pantryByCat).sort((a,b) => b[1]-a[1]).slice(0,4);

  const handleTicket = async (file) => {
    if (!file) return;
    setUploading(true);
    setTicketStatus("Leyendo tu ticket…");
    try {
      const base64 = await fileToBase64(file);
      setTicketStatus("Extrayendo ingredientes…");
      const text = await callClaude([{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 },
          },
          {
            type: "text",
            text: `Analiza este ticket de compra de supermercado y extrae ÚNICAMENTE los productos alimenticios comestibles.
Devuelve SOLO JSON válido, sin markdown, sin texto extra. Formato exacto:
[{"name":"nombre limpio y corto","quantity":número estimado,"unit":"unidad (ud/g/kg/l/ml)","category":"proteina|carbohidrato|verdura|fruta|lacteo|grasa|otros"}]

Reglas:
- Normaliza nombres (ej: "POLLO PECH.FIL." → "Pechuga de pollo")
- Si no hay cantidad visible, estima 1 ud
- Categoriza estrictamente usando las 7 categorías listadas
- Ignora productos no comestibles (limpieza, papel, etc.)
- Ignora totales, impuestos, datos del establecimiento
- Máximo 30 ítems`
          }
        ]
      }], { maxTokens: 1500 });
      const items = parseJSON(text);
      const cleaned = items
        .filter(i => i && i.name)
        .map(i => ({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
          name: String(i.name).trim(),
          quantity: Number(i.quantity) || 1,
          unit: String(i.unit || "ud").trim(),
          category: CATEGORIES[i.category] ? i.category : "otros",
          addedAt: Date.now(),
        }));

      // Merge into pantry
      const merged = [...pantry];
      cleaned.forEach(ni => {
        const idx = merged.findIndex(p => p.name.toLowerCase() === ni.name.toLowerCase() && p.unit === ni.unit);
        if (idx >= 0) merged[idx] = { ...merged[idx], quantity: (merged[idx].quantity || 0) + ni.quantity };
        else merged.push(ni);
      });
      await pantrySet(merged);
      await saveTicketHistory([
        { id: Date.now(), date: Date.now(), count: cleaned.length, items: cleaned.map(c => c.name) },
        ...ticketHistory,
      ].slice(0, 30));
      onToast(`${cleaned.length} ingredientes añadidos a tu despensa`);
      onGoto("pantry");
    } catch (e) {
      console.error(e);
      onToast("No hemos podido leer el ticket. Prueba otra foto.", "error");
    } finally {
      setUploading(false);
      setTicketStatus(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="px-5 pt-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-7 animate-slide-up">
        <div>
          <p className="text-[13px] font-medium text-stone-500 tracking-wide">{greeting},</p>
          <h1 className="font-display text-[40px] leading-[1.05] font-semibold text-stone-900">
            {profile.name || "chef"}.
          </h1>
        </div>
        <button onClick={() => onGoto("profile")}
          className="press w-11 h-11 rounded-full bg-moss text-white font-semibold text-sm ring-2 ring-white shadow">
          {(profile.name || "?").charAt(0).toUpperCase()}
        </button>
      </div>

      {/* Summary card */}
      <div className="relative overflow-hidden rounded-[28px] p-6 mb-5 animate-pop-in shadow-[0_12px_40px_-16px_rgba(61,90,64,0.35)]"
           style={{ background: "linear-gradient(135deg, #3d5a40 0%, #2a4030 100%)" }}>
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-terra-20 blur-2xl" />
        <div className="absolute -left-6 bottom-0 w-32 h-32 rounded-full bg-sage/25 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-sage font-semibold mb-2">
            <Sparkle className="w-3.5 h-3.5" /> Tu cocina hoy
          </div>
          <div className="flex items-baseline gap-2 mb-5">
            <span className="font-display text-[56px] leading-none font-semibold text-white tabular-nums">{pantry.length}</span>
            <span className="text-white/70 text-sm mb-1">ingredientes en despensa</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {topCats.length === 0 ? (
              <span className="text-white/60 text-sm italic">Tu despensa está vacía. Sube un ticket para empezar.</span>
            ) : topCats.map(([c, n]) => {
              const cat = catOf(c);
              const Icon = cat.icon;
              return (
                <div key={c} className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-white/10 backdrop-blur text-white/90 text-xs font-medium">
                  <Icon className="w-3.5 h-3.5" /> {cat.label} · {n}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main CTAs */}
      <div className="grid grid-cols-2 gap-3 mb-5 stagger">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="press relative overflow-hidden rounded-3xl bg-white ring-1 ring-stone-200/70 p-5 text-left disabled:opacity-60 group hover:ring-stone-300 min-h-[150px] flex flex-col justify-between">
          <div className="w-11 h-11 rounded-2xl bg-terra-10 flex items-center justify-center">
            {uploading ? <Loader2 className="w-5 h-5 text-terra animate-spin" /> : <Camera className="w-5 h-5 text-terra" />}
          </div>
          <div>
            <div className="font-display text-[22px] leading-tight font-semibold text-stone-900">Subir ticket</div>
            <div className="text-[13px] text-stone-500 mt-0.5">{uploading ? (ticketStatus || "Procesando…") : "Actualiza tu despensa"}</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                 onChange={(e) => handleTicket(e.target.files?.[0])} />
        </button>
        <button onClick={() => onGoto("recipes")}
          className="press rounded-3xl p-5 text-left min-h-[150px] flex flex-col justify-between relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #e9a988 0%, #c96f4a 100%)" }}>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/20 blur-xl" />
          <div className="w-11 h-11 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div className="relative">
            <div className="font-display text-[22px] leading-tight font-semibold text-white">¿Qué cocino?</div>
            <div className="text-[13px] text-white/85 mt-0.5">3 ideas para ti</div>
          </div>
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-6 animate-slide-up">
        <MiniStat label="Cocinadas" value={recipeHistory.length} icon={Utensils} />
        <MiniStat label="Tickets" value={ticketHistory.length} icon={BookOpen} />
        <MiniStat label="Objetivos" value={profile.goals?.length || 0} icon={Target} />
      </div>

      {/* Recent history */}
      {recipeHistory.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-2xl font-semibold text-stone-900">Últimas recetas</h2>
            <button onClick={() => onGoto("recipes")} className="text-[13px] font-medium text-moss flex items-center gap-1">
              Ver todas <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {recipeHistory.slice(0, 3).map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white ring-1 ring-stone-200/70">
                <div className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center">
                  <Utensils className="w-4 h-4 text-moss" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{r.title}</div>
                  <div className="text-xs text-stone-500">{new Date(r.cookedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</div>
                </div>
                {r.kcal && <div className="text-xs text-stone-500 tabular-nums">{r.kcal} kcal</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-stone-200/70 p-3">
      <div className="flex items-center gap-1.5 text-stone-400 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] uppercase font-semibold tracking-wider">{label}</span>
      </div>
      <div className="font-display text-2xl font-semibold text-stone-900 tabular-nums">{value}</div>
    </div>
  );
}

/* ===================================================================== */
/*  PANTRY                                                                */
/* ===================================================================== */
function PantryTab({ pantry, savePantry, onToast, saveTicketHistory, ticketHistory }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [ticketStatus, setTicketStatus] = useState(null);
  const fileRef = useRef();
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", quantity: 1, unit: "ud", category: "otros" });

  const filtered = pantry
    .filter(i => filter === "all" || i.category === filter)
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => (b.addedAt||0) - (a.addedAt||0));

  const cats = [...new Set(pantry.map(i => i.category))];

  const remove = async (id) => {
    await savePantry(pantry.filter(p => p.id !== id));
    onToast("Eliminado");
  };
  const adjust = async (id, delta) => {
    const next = pantry.map(p => p.id === id ? { ...p, quantity: Math.max(0, (p.quantity || 0) + delta) } : p);
    await savePantry(next.filter(p => p.quantity > 0));
  };

  const handleTicket = async (file) => {
    if (!file) return;
    setUploading(true);
    setTicketStatus("Leyendo tu ticket…");
    try {
      const base64 = await fileToBase64(file);
      setTicketStatus("Extrayendo ingredientes…");
      const text = await callClaude([{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } },
          { type: "text", text: `Analiza este ticket de compra y extrae SOLO productos alimenticios. Devuelve SOLO JSON válido, sin markdown:
[{"name":"nombre limpio","quantity":número,"unit":"ud|g|kg|l|ml","category":"proteina|carbohidrato|verdura|fruta|lacteo|grasa|otros"}]
Normaliza nombres, ignora no-comestibles, máximo 30 ítems.` }
        ]
      }], { maxTokens: 1500 });
      const items = parseJSON(text);
      const cleaned = items.filter(i => i && i.name).map(i => ({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
        name: String(i.name).trim(),
        quantity: Number(i.quantity) || 1,
        unit: String(i.unit || "ud").trim(),
        category: CATEGORIES[i.category] ? i.category : "otros",
        addedAt: Date.now(),
      }));
      const merged = [...pantry];
      cleaned.forEach(ni => {
        const idx = merged.findIndex(p => p.name.toLowerCase() === ni.name.toLowerCase() && p.unit === ni.unit);
        if (idx >= 0) merged[idx] = { ...merged[idx], quantity: (merged[idx].quantity || 0) + ni.quantity };
        else merged.push(ni);
      });
      await savePantry(merged);
      await saveTicketHistory([
        { id: Date.now(), date: Date.now(), count: cleaned.length, items: cleaned.map(c => c.name) },
        ...ticketHistory,
      ].slice(0, 30));
      onToast(`${cleaned.length} ingredientes añadidos`);
    } catch (e) {
      console.error(e);
      onToast("No hemos podido leer el ticket. Prueba otra foto.", "error");
    } finally {
      setUploading(false);
      setTicketStatus(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addManual = async () => {
    if (!newItem.name.trim()) return;
    const item = {
      ...newItem,
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      name: newItem.name.trim(),
      quantity: Number(newItem.quantity) || 1,
      addedAt: Date.now(),
    };
    await savePantry([item, ...pantry]);
    setNewItem({ name: "", quantity: 1, unit: "ud", category: "otros" });
    setAdding(false);
    onToast("Añadido a la despensa");
  };

  return (
    <div className="px-5 pt-8">
      <div className="flex items-end justify-between mb-6 animate-slide-up">
        <div>
          <p className="text-[13px] font-medium text-stone-500 tracking-wide">Despensa</p>
          <h1 className="font-display text-4xl font-semibold text-stone-900">{pantry.length} <span className="text-stone-400 text-2xl">ingredientes</span></h1>
        </div>
        <button onClick={() => setAdding(true)}
          className="press w-11 h-11 rounded-full bg-stone-900 text-white flex items-center justify-center shadow-md">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Upload ticket */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="press w-full mb-4 p-4 rounded-2xl bg-white ring-1 ring-dashed ring-stone-300 hover:ring-moss hover:bg-cream flex items-center gap-3 text-left disabled:opacity-60 animate-slide-up">
        <div className="w-11 h-11 rounded-xl bg-terra-10 flex items-center justify-center shrink-0">
          {uploading ? <Loader2 className="w-5 h-5 text-terra animate-spin" /> : <Upload className="w-5 h-5 text-terra" />}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-stone-900">{uploading ? (ticketStatus || "Procesando ticket…") : "Subir ticket de compra"}</div>
          <div className="text-xs text-stone-500">{uploading ? "Esto tarda unos segundos" : "Foto del ticket → despensa actualizada"}</div>
        </div>
        {!uploading && <ChevronRight className="w-5 h-5 text-stone-400" />}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
               onChange={(e) => handleTicket(e.target.files?.[0])} />
      </button>

      {/* Search */}
      {pantry.length > 0 && (
        <>
          <div className="relative mb-3 animate-slide-up">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en la despensa…"
              className="w-full h-11 pl-4 pr-10 rounded-xl bg-white ring-1 ring-stone-200 focus:ring-2 focus:ring-moss focus:outline-none text-sm" />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1 animate-slide-up">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todos · {pantry.length}</FilterChip>
            {cats.map(c => {
              const cat = catOf(c);
              const Icon = cat.icon;
              const count = pantry.filter(p => p.category === c).length;
              return (
                <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
                  <Icon className="w-3.5 h-3.5" /> {cat.label} · {count}
                </FilterChip>
              );
            })}
          </div>
        </>
      )}

      {/* Items */}
      {pantry.length === 0 && !uploading && <EmptyPantry onUpload={() => fileRef.current?.click()} />}

      {uploading && (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-[72px] rounded-2xl shimmer" />)}
        </div>
      )}

      <div className="space-y-2 stagger">
        {filtered.map(item => (
          <PantryCard key={item.id} item={item} onRemove={() => remove(item.id)} onAdjust={(d) => adjust(item.id, d)} />
        ))}
      </div>

      {/* Add manual modal */}
      {adding && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-appbg p-5 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-2xl font-semibold">Añadir ingrediente</h3>
              <button onClick={() => setAdding(false)} className="press w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}
                placeholder="Nombre (ej. Pechuga de pollo)" className={inputCls} autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                  placeholder="Cantidad" className={inputCls} />
                <select value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})}
                  className={inputCls}>
                  <option value="ud">ud</option><option value="g">g</option><option value="kg">kg</option>
                  <option value="ml">ml</option><option value="l">l</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CATEGORIES).map(([k, c]) => (
                  <button key={k} onClick={() => setNewItem({...newItem, category: k})}
                    className={`press px-3 h-9 rounded-full text-xs font-medium ring-1 ${
                      newItem.category === k ? `${c.bg} ${c.text} ring-current` : "bg-white text-stone-700 ring-stone-200"
                    }`}>{c.label}</button>
                ))}
              </div>
              <button onClick={addManual}
                className="press w-full h-12 rounded-xl bg-moss text-white font-semibold">
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`press shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-xs font-semibold ring-1 whitespace-nowrap ${
        active ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-700 ring-stone-200"
      }`}>
      {children}
    </button>
  );
}

function PantryCard({ item, onRemove, onAdjust }) {
  const cat = catOf(item.category);
  const Icon = cat.icon;
  return (
    <div className={`press flex items-center gap-3 p-3 rounded-2xl bg-white ring-1 ring-stone-200/70 hover:ring-stone-300 group`}>
      <div className={`w-12 h-12 rounded-xl ${cat.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${cat.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] text-stone-900 truncate">{item.name}</div>
        <div className="text-xs text-stone-500">{cat.label}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onAdjust(-1)} className="press w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center">
          <Minus className="w-3.5 h-3.5 text-stone-600" />
        </button>
        <div className="min-w-[48px] text-center font-semibold text-sm tabular-nums">
          {item.quantity}<span className="text-stone-400 text-xs ml-0.5">{item.unit}</span>
        </div>
        <button onClick={() => onAdjust(1)} className="press w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-stone-600" />
        </button>
        <button onClick={onRemove} className="press w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
        </button>
      </div>
    </div>
  );
}

function EmptyPantry({ onUpload }) {
  return (
    <div className="flex flex-col items-center text-center py-12 animate-slide-up">
      <svg width="140" height="140" viewBox="0 0 140 140" className="mb-4">
        <defs>
          <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f3ede2" />
            <stop offset="1" stopColor="#e9e2d4" />
          </linearGradient>
        </defs>
        <rect x="20" y="30" width="100" height="92" rx="14" fill="url(#g1)" />
        <rect x="30" y="42" width="80" height="12" rx="4" fill="#d4ccbc" />
        <rect x="30" y="62" width="54" height="10" rx="3" fill="#d4ccbc" opacity=".6" />
        <rect x="30" y="78" width="70" height="10" rx="3" fill="#d4ccbc" opacity=".6" />
        <rect x="30" y="94" width="44" height="10" rx="3" fill="#d4ccbc" opacity=".6" />
        <circle cx="108" cy="30" r="14" fill="#c96f4a" />
        <path d="M103 30l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
      <h3 className="font-display text-2xl font-semibold mb-1">Despensa vacía</h3>
      <p className="text-stone-500 text-sm max-w-xs mb-5">Sube tu primer ticket de compra y la rellenamos por ti en segundos.</p>
      <button onClick={onUpload}
        className="press px-6 h-12 rounded-full bg-moss text-white font-semibold text-sm flex items-center gap-2 shadow">
        <Camera className="w-4 h-4" /> Subir ticket
      </button>
    </div>
  );
}

/* ===================================================================== */
/*  RECIPES                                                               */
/* ===================================================================== */
function RecipesTab({ profile, pantry, savePantry, recipes, setRecipes, recipeHistory, saveRecipeHistory, onToast }) {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState("suggestions"); // suggestions | history

  const generate = async () => {
    setLoading(true);
    setError(null);
    setLoadingMsg("Analizando tu despensa…");
    try {
      setTimeout(() => setLoadingMsg("Buscando recetas que encajen contigo…"), 1200);
      const profileSummary = {
        age: profile.age, weight: profile.weight, height: profile.height,
        activity: profile.activity, training: profile.training,
        frequency: profile.frequency, duration: profile.duration,
        goals: profile.goals, goalNotes: profile.goalNotes,
        restrictions: profile.restrictions, allergies: profile.allergies,
      };
      const pantryList = pantry.map(p => `${p.name} (${p.quantity}${p.unit}, ${p.category})`);

      const prompt = `Eres un coach nutricional. Propón 3 recetas personalizadas para este usuario.

PERFIL: ${JSON.stringify(profileSummary)}
DESPENSA ACTUAL: ${pantryList.length ? pantryList.join(", ") : "(vacía)"}

REGLAS:
- Las recetas deben usar MAYORITARIAMENTE ingredientes de la despensa
- Deben respetar todas las restricciones y alergias del perfil
- Deben encajar con los objetivos del usuario (kcal y macros coherentes)
- Si falta algún ingrediente, lístalo en "missing"
- Pasos concisos (5-7 bullets máximo)

Devuelve SOLO JSON válido sin markdown, formato exacto:
[
  {
    "title":"nombre apetecible",
    "description":"1 frase que la venda",
    "time":minutos,
    "difficulty":"Fácil|Media|Alta",
    "kcal":número,
    "protein":gramos,
    "carbs":gramos,
    "fat":gramos,
    "uses":["ingrediente de la despensa 1","..."],
    "missing":["ingrediente a comprar (o vacío)"],
    "steps":["paso 1","paso 2","..."],
    "fit":"1 frase explicando por qué encaja con su objetivo"
  }
]

Exactamente 3 recetas.`;

      const text = await callClaude([{ role: "user", content: prompt }], { maxTokens: 2500 });
      const data = parseJSON(text);
      if (!Array.isArray(data) || data.length === 0) throw new Error("Respuesta vacía");
      setRecipes(data.map(r => ({ ...r, id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) })));
      setView("suggestions");
    } catch (e) {
      console.error(e);
      setError("No hemos podido generar recetas. Reintenta en un momento.");
    } finally {
      setLoading(false);
      setLoadingMsg(null);
    }
  };

  const markCooked = async (recipe) => {
    // Try to subtract matched pantry items (rough heuristic: name contained)
    const used = (recipe.uses || []).map(u => u.toLowerCase());
    let next = pantry.map(p => {
      const hit = used.some(u => u.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(u));
      if (hit) return { ...p, quantity: Math.max(0, (p.quantity || 0) - 1) };
      return p;
    }).filter(p => p.quantity > 0);
    await savePantry(next);
    await saveRecipeHistory([
      {
        id: recipe.id,
        title: recipe.title,
        kcal: recipe.kcal,
        cookedAt: Date.now(),
      },
      ...recipeHistory,
    ].slice(0, 100));
    onToast(`¡${recipe.title} cocinada!`);
  };

  return (
    <div className="px-5 pt-8">
      <div className="mb-6 animate-slide-up">
        <p className="text-[13px] font-medium text-stone-500 tracking-wide">Recetas</p>
        <h1 className="font-display text-4xl font-semibold text-stone-900">¿Qué cocinamos?</h1>
      </div>

      {/* Segmented */}
      <div className="flex p-1 rounded-2xl bg-stone-100 mb-5 animate-slide-up">
        {[
          { id: "suggestions", label: "Sugerencias", icon: Sparkle },
          { id: "history", label: "Cocinadas", icon: BookOpen },
        ].map(s => (
          <button key={s.id} onClick={() => setView(s.id)}
            className={`press flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
              view === s.id ? "bg-white shadow-sm text-stone-900" : "text-stone-500"
            }`}>
            <s.icon className="w-4 h-4" /> {s.label}
          </button>
        ))}
      </div>

      {view === "suggestions" && (
        <>
          <button
            onClick={generate}
            disabled={loading}
            className="press w-full p-5 rounded-3xl mb-4 text-left relative overflow-hidden animate-slide-up disabled:opacity-80"
            style={{ background: "linear-gradient(135deg, #3d5a40 0%, #2a4030 100%)" }}>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-terra-25 blur-2xl" />
            <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-sage/30 blur-xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                {loading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Sparkles className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1">
                <div className="font-display text-[22px] font-semibold text-white leading-tight">
                  {loading ? (loadingMsg || "Pensando…") : "Generar 3 recetas para hoy"}
                </div>
                <div className="text-[13px] text-white/70 mt-0.5">
                  {loading ? "Tu coach está trabajando" : `Con tus ${pantry.length} ingredientes y tu objetivo`}
                </div>
              </div>
              {!loading && <ArrowRight className="w-5 h-5 text-white/80" />}
            </div>
          </button>

          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-rose-50 ring-1 ring-rose-100 flex items-start gap-3 animate-slide-up">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-rose-900">{error}</div>
                <button onClick={generate} className="press mt-2 text-sm font-semibold text-rose-700 inline-flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Reintentar
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-48 rounded-3xl shimmer" />)}
            </div>
          )}

          {!loading && recipes.length === 0 && !error && (
            <EmptyRecipes hasPantry={pantry.length > 0} />
          )}

          {!loading && recipes.length > 0 && (
            <div className="space-y-3 stagger">
              {recipes.map(r => <RecipeCard key={r.id} recipe={r} onCook={() => markCooked(r)} />)}
            </div>
          )}
        </>
      )}

      {view === "history" && (
        <div>
          {recipeHistory.length === 0 ? (
            <div className="text-center py-12 animate-slide-up">
              <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-3">
                <Utensils className="w-7 h-7 text-stone-400" />
              </div>
              <h3 className="font-display text-xl font-semibold">Aún no has cocinado nada</h3>
              <p className="text-sm text-stone-500 mt-1">Cuando marques una receta como cocinada, aparecerá aquí.</p>
            </div>
          ) : (
            <div className="space-y-2 stagger">
              {recipeHistory.map(r => (
                <div key={r.id + r.cookedAt} className="p-4 rounded-2xl bg-white ring-1 ring-stone-200/70 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center">
                    <Utensils className="w-4 h-4 text-moss" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{r.title}</div>
                    <div className="text-xs text-stone-500">
                      {new Date(r.cookedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                  {r.kcal && <div className="text-xs font-medium text-stone-600 tabular-nums">{r.kcal} kcal</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, onCook }) {
  const [open, setOpen] = useState(false);
  const [cooked, setCooked] = useState(false);
  const diffColor = {
    "Fácil": "bg-emerald-50 text-emerald-700 ring-emerald-100",
    "Media": "bg-amber-50 text-amber-700 ring-amber-100",
    "Alta":  "bg-rose-50 text-rose-700 ring-rose-100",
  }[recipe.difficulty] || "bg-stone-100 text-stone-700 ring-stone-200";

  const handleCook = () => {
    setCooked(true);
    setTimeout(() => onCook(), 500);
  };

  return (
    <div className={`rounded-3xl bg-white ring-1 ring-stone-200/70 overflow-hidden transition-all ${cooked ? "opacity-40 scale-95" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full p-5 text-left press">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-[22px] font-semibold text-stone-900 leading-tight">{recipe.title}</h3>
            <p className="text-sm text-stone-500 mt-1 leading-relaxed">{recipe.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-stone-100 text-stone-700 text-xs font-medium">
            <Clock className="w-3 h-3" /> {recipe.time} min
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-full ring-1 text-xs font-medium ${diffColor}`}>
            {recipe.difficulty}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-terra-10 text-terra text-xs font-semibold">
            <Flame className="w-3 h-3" /> {recipe.kcal} kcal
          </span>
        </div>

        {/* Macros bar */}
        <MacrosBar protein={recipe.protein} carbs={recipe.carbs} fat={recipe.fat} />

        {/* Fit */}
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-cream-60">
          <Target className="w-4 h-4 text-moss shrink-0 mt-0.5" />
          <p className="text-[13px] text-stone-700 leading-snug">{recipe.fit}</p>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 animate-slide-up">
          {recipe.uses?.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">Usa de tu despensa</div>
              <div className="flex flex-wrap gap-1.5">
                {recipe.uses.map((u,i) => (
                  <span key={i} className="px-2.5 h-7 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 text-xs font-medium">
                    <Check className="w-3 h-3 mr-1" /> {u}
                  </span>
                ))}
              </div>
            </div>
          )}
          {recipe.missing?.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">Te falta</div>
              <div className="flex flex-wrap gap-1.5">
                {recipe.missing.map((u,i) => (
                  <span key={i} className="px-2.5 h-7 inline-flex items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100 text-xs font-medium">
                    <Plus className="w-3 h-3 mr-1" /> {u}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-2">Pasos</div>
            <ol className="space-y-2">
              {recipe.steps?.map((s,i) => (
                <li key={i} className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-moss text-white text-[11px] font-bold flex items-center justify-center">
                    {i+1}
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed pt-0.5">{s}</p>
                </li>
              ))}
            </ol>
          </div>
          <button onClick={handleCook} disabled={cooked}
            className="press w-full h-12 rounded-xl bg-moss text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {cooked ? <><Check className="w-4 h-4" /> ¡Cocinada!</> : <><Utensils className="w-4 h-4" /> Marcar como cocinada</>}
          </button>
        </div>
      )}
    </div>
  );
}

function MacrosBar({ protein = 0, carbs = 0, fat = 0 }) {
  const total = Math.max(1, protein + carbs + fat);
  const pP = (protein / total) * 100;
  const pC = (carbs / total) * 100;
  const pF = (fat / total) * 100;
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden">
        <div className="bg-rose-400" style={{ width: `${pP}%` }} />
        <div className="bg-amber-400" style={{ width: `${pC}%` }} />
        <div className="bg-yellow-600" style={{ width: `${pF}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] font-medium text-stone-500">
        <span><span className="w-2 h-2 rounded-full bg-rose-400 inline-block mr-1" />P {protein}g</span>
        <span><span className="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1" />C {carbs}g</span>
        <span><span className="w-2 h-2 rounded-full bg-yellow-600 inline-block mr-1" />G {fat}g</span>
      </div>
    </div>
  );
}

function EmptyRecipes({ hasPantry }) {
  return (
    <div className="flex flex-col items-center text-center py-10 animate-slide-up">
      <svg width="140" height="140" viewBox="0 0 140 140" className="mb-4">
        <circle cx="70" cy="80" r="40" fill="#f3ede2" />
        <path d="M38 80 Q70 50 102 80" stroke="#3d5a40" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="70" cy="48" r="8" fill="#c96f4a" />
        <path d="M70 40 Q66 32 70 24 Q74 32 70 40" fill="#8aa785" />
      </svg>
      <h3 className="font-display text-2xl font-semibold mb-1">Sin sugerencias todavía</h3>
      <p className="text-stone-500 text-sm max-w-xs">
        {hasPantry
          ? "Toca el botón verde de arriba y te preparamos 3 recetas."
          : "Sube un ticket primero para que tu coach sepa qué tienes."}
      </p>
    </div>
  );
}

/* ===================================================================== */
/*  PROFILE                                                               */
/* ===================================================================== */
function ProfileTab({ profile, saveProfile, onToast }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(profile);

  const save = async () => {
    await saveProfile(draft);
    setEdit(false);
    onToast("Perfil actualizado");
  };

  return (
    <div className="px-5 pt-8">
      <div className="flex items-end justify-between mb-6 animate-slide-up">
        <div>
          <p className="text-[13px] font-medium text-stone-500 tracking-wide">Perfil</p>
          <h1 className="font-display text-4xl font-semibold text-stone-900 leading-tight">{profile.name}</h1>
        </div>
        <button onClick={() => edit ? save() : setEdit(true)}
          className="press px-4 h-10 rounded-full bg-stone-900 text-white text-sm font-semibold">
          {edit ? "Guardar" : "Editar"}
        </button>
      </div>

      {/* Avatar card */}
      <div className="mb-5 p-5 rounded-3xl animate-slide-up relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, #f3ede2 0%, #e9e2d4 100%)" }}>
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-sage/20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-moss flex items-center justify-center text-white font-display text-2xl font-semibold">
            {(profile.name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-display text-2xl font-semibold">{profile.name}</div>
            <div className="text-sm text-stone-600">{profile.age} años · {profile.weight}kg · {profile.height}cm</div>
          </div>
        </div>
      </div>

      {!edit ? (
        <div className="space-y-3 stagger">
          <ProfileSection title="Estilo de vida" icon={Activity}>
            <Row label="Actividad" value={ACTIVITY.find(a => a.id === profile.activity)?.label || "—"} />
            <Row label="Sueño" value={profile.sleep ? `${profile.sleep} h` : "—"} />
            {profile.profession && <Row label="Profesión" value={profile.profession} />}
          </ProfileSection>
          <ProfileSection title="Entrenamiento" icon={Dumbbell}>
            <Row label="Tipo" value={TRAINING.find(t => t.id === profile.training)?.label || "—"} />
            <Row label="Frecuencia" value={profile.frequency ? `${profile.frequency} sesiones/sem` : "—"} />
            <Row label="Duración" value={profile.duration ? `${profile.duration} min` : "—"} />
            {profile.timeOfDay && <Row label="Momento" value={profile.timeOfDay} />}
          </ProfileSection>
          <ProfileSection title="Objetivos" icon={Target}>
            <div className="flex flex-wrap gap-1.5 p-4">
              {profile.goals?.map(g => {
                const goal = GOALS.find(x => x.id === g);
                if (!goal) return null;
                const Icon = goal.icon;
                return (
                  <span key={g} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-moss text-white text-xs font-semibold">
                    <Icon className="w-3.5 h-3.5" /> {goal.label}
                  </span>
                );
              })}
            </div>
            {profile.goalNotes && <div className="px-4 pb-4 text-sm text-stone-600 italic">"{profile.goalNotes}"</div>}
          </ProfileSection>
          {(profile.restrictions?.length > 0 || profile.allergies) && (
            <ProfileSection title="Restricciones" icon={AlertCircle}>
              <div className="flex flex-wrap gap-1.5 p-4">
                {profile.restrictions?.map(r => (
                  <span key={r} className="inline-flex items-center px-3 h-8 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold">{r}</span>
                ))}
              </div>
              {profile.allergies && <div className="px-4 pb-4 text-sm text-stone-600">{profile.allergies}</div>}
            </ProfileSection>
          )}
        </div>
      ) : (
        <EditProfile draft={draft} setDraft={setDraft} />
      )}

      <button onClick={async () => {
        if (confirm("¿Borrar perfil y empezar de cero? Se perderán despensa e historial.")) {
          await Promise.all([
            storage.set("profile:user", null),
            storage.set("pantry:items", []),
            storage.set("history:recipes", []),
            storage.set("history:tickets", []),
          ]);
          window.location.reload();
        }
      }} className="press mt-6 mb-2 w-full h-11 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50">
        Borrar perfil y datos
      </button>
    </div>
  );
}

function ProfileSection({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-stone-200/70 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Icon className="w-4 h-4 text-moss" />
        <h3 className="font-display text-lg font-semibold">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-stone-100">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="text-sm font-semibold text-stone-900">{value}</span>
    </div>
  );
}

function EditProfile({ draft, setDraft }) {
  return (
    <div className="space-y-4 animate-slide-up">
      <div className="p-4 rounded-2xl bg-white ring-1 ring-stone-200/70 space-y-3">
        <h3 className="font-display text-lg font-semibold mb-1">Datos básicos</h3>
        <input value={draft.name || ""} onChange={e => setDraft({...draft, name: e.target.value})}
          placeholder="Nombre" className={inputCls} />
        <div className="grid grid-cols-3 gap-2">
          <input type="number" value={draft.age || ""} onChange={e => setDraft({...draft, age: e.target.value})} placeholder="Edad" className={inputCls} />
          <input type="number" value={draft.weight || ""} onChange={e => setDraft({...draft, weight: e.target.value})} placeholder="kg" className={inputCls} />
          <input type="number" value={draft.height || ""} onChange={e => setDraft({...draft, height: e.target.value})} placeholder="cm" className={inputCls} />
        </div>
      </div>
      <div className="p-4 rounded-2xl bg-white ring-1 ring-stone-200/70">
        <h3 className="font-display text-lg font-semibold mb-2">Objetivos</h3>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map(g => {
            const Icon = g.icon;
            const active = draft.goals?.includes(g.id);
            return (
              <button key={g.id} onClick={() => {
                const has = draft.goals?.includes(g.id);
                setDraft({...draft, goals: has ? draft.goals.filter(x => x !== g.id) : [...(draft.goals||[]), g.id]});
              }}
                className={`press p-3 rounded-xl text-left ring-1 ${
                  active ? "bg-moss text-white ring-moss" : "bg-white text-stone-900 ring-stone-200"
                }`}>
                <Icon className={`w-4 h-4 mb-1 ${active ? "text-white" : "text-moss"}`} />
                <div className="text-[13px] font-semibold">{g.label}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4 rounded-2xl bg-white ring-1 ring-stone-200/70">
        <h3 className="font-display text-lg font-semibold mb-2">Restricciones</h3>
        <div className="flex flex-wrap gap-1.5">
          {RESTRICTIONS.map(r => {
            const active = draft.restrictions?.includes(r);
            return (
              <button key={r} onClick={() => {
                const has = draft.restrictions?.includes(r);
                setDraft({...draft, restrictions: has ? draft.restrictions.filter(x => x !== r) : [...(draft.restrictions||[]), r]});
              }}
                className={`press px-3 h-9 rounded-full text-xs font-semibold ring-1 ${
                  active ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-900 ring-stone-200"
                }`}>{r}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  TAB BAR                                                               */
/* ===================================================================== */
function TabBar({ tab, setTab }) {
  const tabs = [
    { id: "home", icon: Home, label: "Inicio" },
    { id: "pantry", icon: Package, label: "Despensa" },
    { id: "recipes", icon: ChefHat, label: "Recetas" },
    { id: "profile", icon: User, label: "Perfil" },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-[900px] px-4 pb-4 pointer-events-auto">
        <div className="relative bg-white/85 backdrop-blur-xl ring-1 ring-stone-200/80 rounded-[28px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] p-1.5 flex">
          {tabs.map(t => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`press relative flex-1 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                  active ? "text-white" : "text-stone-500 hover:text-stone-800"
                }`}>
                {active && (
                  <span className="absolute inset-0 rounded-2xl bg-moss animate-pop-in" />
                )}
                <Icon className="w-[18px] h-[18px] relative" strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold relative tracking-wide">{t.label}</span>
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
      <div className={`px-5 h-12 rounded-full flex items-center gap-2 shadow-xl ring-1 ${
        toast.type === "error" ? "bg-rose-600 text-white ring-rose-700" : "bg-stone-900 text-white ring-stone-800"
      }`}>
        {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
        <span className="text-sm font-medium">{toast.text}</span>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  UTILS                                                                 */
/* ===================================================================== */
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
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
        res(dataUrl.split(",")[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

