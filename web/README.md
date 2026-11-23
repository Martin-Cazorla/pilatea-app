# PILATEA web (Next.js)

Nueva versión de PILATEA con Next.js (App Router) + TypeScript + Tailwind CSS + Firebase
(Auth y Firestore). Usa el mismo proyecto de Firebase (`pilatea-app-v2`) y las mismas
reglas (`../firestore.rules`) que el sitio estático actual, que sigue en la raíz del repo
hasta que esta versión lo reemplace.

## Desarrollo

```bash
cd web
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
npm run build      # build de producción
npm run lint
```

## Estructura

```
src/
  app/              páginas (home, login, reservas, admin)
  components/       Header, Footer, fondo de página, etc.
  lib/
    firebase/client.ts   Auth + Firestore en el navegador
    firebase/admin.ts    firebase-admin, solo servidor (alta de alumnos)
    fechas.ts            fechas en hora de Argentina (UTC-3)
    disciplinas.ts       Reformer, HIIT Barre, Yoga
public/img/         imágenes del sitio
```

Colores y tipografías: `src/app/globals.css` (bloque `@theme`), tomados de
`../scss/base/_variables.scss`.

## Fases

1. Base del proyecto y estilos (esta)
2. Login y roles
3. Reservas del alumno
4. Panel de staff
5. Salida a producción
