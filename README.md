# cohort-schedules

Dashboard **4Geeks Horarios**: visualiza cohortes de Notion en la zona horaria del alumno, con **Cohort Code** y las tres fechas académicas.

Réplica mejorada de [admissions-sync-tool.replit.app](https://admissions-sync-tool.replit.app/).

## Qué muestra

- Conversión de horario ancla → hora local del país del alumno
- Detección de cambios DST y tramos horarios
- **Arriba:** una referencia de inicio estimada para el mes/año elegido (sintética, no Notion)
- **Abajo:** todas las cohortes abiertas de Notion (sin filtro por mes)
- **`Cohort Code`** (solo lectura desde Notion; lo asigna el cron [`generate-cohort-ids`](https://github.com/4GAES/generate-cohort-ids))
- Fechas:
  - **Prework** → `Start date (prework)`
  - **Inicio** → `Start Date (content)`
  - **Fin** → `End Date (course)`

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- `@notionhq/client` (servidor)
- Luxon (DST / offsets)

## Setup

### 1. Notion

1. Crea una integración en [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Comparte la base de cohortes con la integración
3. Copia el token y el database ID

Asegúrate de que exista la propiedad Text **`Cohort Code`** (la rellena el cron de IDs).

### 2. Env

```bash
cp .env.example .env.local
```

```env
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...
ID_PROPERTY_NAME=Cohort Code
```

### 3. Run

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/countries` | Catálogo de países |
| `GET` | `/api/cohorts/raw` | Cohortes de Notion (sin conversión horaria) |
| `GET` | `/api/cohorts?country&month&year&duration` | Opciones convertidas (API externa) |
| `GET` | `/api/dst-changes` | Calendario DST (ES/PT/CL) |
| `POST` | `/api/refresh` | Invalida cache y relee Notion |

## Notas

- El browser **nunca** ve `NOTION_TOKEN`.
- Este repo **no escribe** `Cohort Code`; solo lo muestra.
- Cache en memoria ~10 min; “Actualizar datos” fuerza refresh.
- El dashboard carga `/api/cohorts/raw` una vez; cambiar país/mes/año/duración recalcula en el cliente (sin nuevo fetch a Notion).
- La sync de Notion replica el filtro de la vista de admisiones:
  - `Start date (prework)` **≥ hoy** (UTC)
  - `Status` ∈ Enrolling, Unstarted, Ready to Create, Created
  - `Open` = sí
