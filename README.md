# Nexo

App de finanzas personales (PWA). Registro manual, importación desde Money
Manager y dashboard. **Next.js 16 + Supabase**, mobile-first.

## Stack

- **Next.js 16** (App Router, PWA) + **React 19** + **Tailwind 4**
- **Supabase** (Postgres, Auth, RLS) — acceso vía `@supabase/ssr`
- Auth por **magic link** (sin contraseñas)

## Estructura

```
src/
  app/
    login/            # acceso por magic link
    auth/callback/    # intercambio de código -> sesión
    auth/signout/
    dashboard/        # patrimonio, cuentas, gasto por categoría, movimientos
    manifest.ts       # web app manifest (PWA)
  components/
    QuickEntry.tsx    # alta rápida de gasto/ingreso/transferencia
  lib/
    supabase/         # clientes (browser/server), proxy de sesión, tipos
    format.ts         # formato COP y fechas
  proxy.ts            # auth gating (antes "middleware")
supabase/
  migrations/         # esquema versionado
scripts/
  import-excel.ts     # importador del export de Money Manager
public/sw.js          # service worker (PWA)
```

## Modelo de datos

`accounts`, `categories` (jerárquicas), `transactions`
(income/expense/transfer/adjustment), `import_batches`. Saldos vía la vista
`account_balances`. RLS: cada usuario solo ve lo suyo.

## Puesta en marcha

### 1. Variables de entorno

Copia `.env.example` a `.env.local` y llena con los datos de tu proyecto
Supabase (Dashboard → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # solo para el importador
IMPORT_USER_ID=...              # tu user id de Auth (para importar)
```

### 2. Base de datos

**Opción A — Supabase en la nube** (recomendado para usar en el celular):

```bash
supabase link --project-ref <tu-ref>
npm run db:push        # aplica migrations al proyecto remoto
```

**Opción B — Supabase local** (requiere Docker):

```bash
supabase start
supabase db reset      # aplica migrations en local
```

### 3. Importar tu historial

```bash
npm run import "/ruta/al/2026-07-11.xlsx" --dry-run   # revisa el resumen
npm run import "/ruta/al/2026-07-11.xlsx"             # inserta en Supabase
```

El importador fusiona las transferencias (que Money Manager exporta en 2 filas)
y trata las filas de balance como ajustes.

### 4. Correr la app

```bash
npm run dev            # http://localhost:3000
```

Para instalarla en el iPhone: ábrela en Safari → Compartir → "Agregar a inicio".

## Notas

- **Saldos iniciales:** el export de Money Manager no incluye el saldo inicial
  de cada cuenta, así que se importan en 0 y los saldos reflejan el flujo neto
  desde el primer movimiento. Ajusta `initial_balance` de cada cuenta para que
  los saldos coincidan con la realidad (initial = saldo_actual − flujo_neto).
- Fase 2 (pendiente): automatización del registro desde correos de banco con un
  inbox de verificación.
