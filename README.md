# Coach — Nutrición Personal con IA

App PWA de coaching nutricional personal, impulsada por Claude.

## Deploy en Vercel (10 minutos)

### 1. Subir a GitHub

1. Andá a [github.com](https://github.com) → **New repository**
2. Nombre: `nutrition-coach` → **Create repository**
3. En la página del repo vacío, hacé clic en **"uploading an existing file"**
4. Arrastrá **todos los archivos** de esta carpeta (respetando la estructura)
5. Commit → **Commit changes**

### 2. Deploy en Vercel

1. Andá a [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. Click **"Add New Project"**
3. Importá el repo `nutrition-coach`
4. Vercel detecta Create React App automáticamente
5. Click **Deploy** → listo en ~2 minutos

Tu URL queda algo como: `https://nutrition-coach-nico.vercel.app`

### 3. Instalar como PWA en el iPhone

1. Abrí la URL en **Safari** (tiene que ser Safari, no Chrome)
2. Tocá el botón **Compartir** (el cuadrado con flecha)
3. Scroll hasta **"Agregar a pantalla de inicio"**
4. Nombre: "Coach" → **Agregar**

La app aparece en tu home screen y abre sin barra del navegador.

## Estructura del proyecto

```
nutrition-coach-pwa/
├── public/
│   ├── index.html
│   ├── manifest.json      ← Configuración PWA
│   └── favicon.svg
├── src/
│   ├── index.js
│   └── App.jsx            ← Toda la lógica de la app
├── package.json
├── vercel.json
└── .gitignore
```

## Datos y persistencia

Los datos se guardan en `localStorage` del navegador. Son locales a tu dispositivo y persisten entre sesiones.

## Notas

- La IA funciona dentro del entorno de Claude.ai (artefactos). Para uso externo necesitás una API key de Anthropic en variable de entorno `REACT_APP_ANTHROPIC_KEY`.

## API Key para el deploy externo (IMPORTANTE)

Cuando la app corre fuera de Claude.ai, necesita tu API key de Anthropic.

### Cómo obtenerla
1. Andá a [console.anthropic.com](https://console.anthropic.com)
2. API Keys → **Create Key** → copiala

### Cómo configurarla en Vercel
1. En tu proyecto de Vercel → **Settings → Environment Variables**
2. Name: `REACT_APP_ANTHROPIC_KEY`
3. Value: tu API key (`sk-ant-...`)
4. Environments: Production, Preview, Development
5. **Save** → **Redeploy**

⚠️ La API key es gratuita con créditos iniciales. El uso de la app (scan de ticket + recetas) cuesta aprox. $0.01–0.03 por sesión.
