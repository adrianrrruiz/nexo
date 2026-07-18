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

## MCP financiero para Claude

Nexo expone un MCP remoto de solo lectura en `/api/mcp`. Incluye herramientas
para resumir finanzas, buscar movimientos, comparar periodos y consultar saldos.
El endpoint acepta OAuth 2.1 de Supabase Auth: cada solicitud se vincula al
usuario autenticado y las herramientas consultan únicamente su `user_id`.
La migración `mcp_oauth_read_only` añade políticas restrictivas para que los
tokens OAuth tampoco puedan escribir directamente mediante la Data API.

### Activar el conector OAuth

En el dashboard del proyecto de Supabase:

1. En **Authentication → URL Configuration**, configura como **Site URL** el
   dominio de producción de Nexo, por ejemplo `https://nexo.example.com`.
2. En **Authentication → OAuth Server**, activa el servidor OAuth 2.1.
3. Configura **Authorization Path** como `/oauth/consent`.
4. Activa **Dynamic Client Registration** para que los clientes MCP puedan
   registrarse automáticamente.
5. Usa una llave de firma JWT asimétrica (RS256 o ES256), recomendada por
   Supabase para OAuth.

Aplica la política de solo lectura y vuelve a desplegar la aplicación:

```bash
npm run db:push
# después, publica el nuevo commit en Vercel
```

Después de desplegar, estos endpoints deben ser públicos:

```text
https://TU-DOMINIO/api/mcp
https://TU-DOMINIO/.well-known/oauth-protected-resource
https://TU-DOMINIO/.well-known/oauth-protected-resource/api/mcp
```

Para agregarlo en Claude, crea un conector personalizado con la URL
`https://TU-DOMINIO/api/mcp`. Claude descubrirá Supabase Auth, abrirá el login
por código de Nexo y mostrará la pantalla de consentimiento antes de emitir los
tokens de acceso y renovación.

### Compatibilidad con el token personal

El Bearer token anterior continúa disponible temporalmente para no interrumpir
Claude Code durante la migración. Configura estas variables tanto en
`.env.local` como en Vercel solo si todavía lo utilizas:

```bash
MCP_ACCESS_TOKEN=<token personal existente de al menos 32 bytes>
MCP_USER_ID=<uuid vinculado al token personal>
SUPABASE_SERVICE_ROLE_KEY=<clave server-side de Supabase ya configurada>
```

La clave `SUPABASE_SERVICE_ROLE_KEY` se reutiliza en el MCP y nunca debe llevar
el prefijo `NEXT_PUBLIC_`.

El repositorio incluye `.mcp.json` sin secretos. Antes de abrir Claude Code,
define estas variables en tu terminal:

```bash
export NEXO_MCP_URL=https://TU-DOMINIO
export NEXO_MCP_TOKEN=TU_MCP_ACCESS_TOKEN
```

Al abrir Claude Code en este proyecto, aprueba el servidor de alcance de proyecto
y verifica la conexión con `/mcp`. El archivo versionado solo contiene referencias
a variables de entorno; el token permanece fuera de Git. Cuando Claude Code use
el conector OAuth, podrán retirarse `MCP_ACCESS_TOKEN`, `MCP_USER_ID` y los
encabezados de `.mcp.json`.

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
