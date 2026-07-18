import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod'
import { getMcpUserId, MCP_READ_SCOPE, verifyMcpToken } from '@/lib/mcp/auth'
import {
  comparePeriods,
  getFinancialSummary,
  listAccounts,
  searchTransactions,
} from '@/lib/mcp/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato YYYY-MM-DD.')

function jsonContent(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  }
}

function toolError(error: unknown) {
  console.error('Nexo MCP tool error', error)
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: 'No se pudo consultar la información financiera. Revisa los filtros o intenta de nuevo.',
      },
    ],
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'get_financial_summary',
      {
        title: 'Resumen financiero',
        description:
          'Resume ingresos, gastos, flujo neto y principales categorías en un periodo. Si no indicas fechas, usa el mes actual en Colombia.',
        inputSchema: {
          start_date: dateSchema.optional().describe('Fecha inicial inclusiva.'),
          end_date: dateSchema.optional().describe('Fecha final inclusiva.'),
        },
      },
      async ({ start_date, end_date }, { authInfo }) => {
        try {
          return jsonContent(
            await getFinancialSummary(
              getMcpUserId(authInfo),
              start_date,
              end_date
            )
          )
        } catch (error) {
          return toolError(error)
        }
      }
    )

    server.registerTool(
      'search_transactions',
      {
        title: 'Buscar movimientos',
        description:
          'Busca hasta 50 movimientos financieros usando filtros. Devuelve nombres de cuenta y categoría, nunca credenciales ni datos de otros usuarios.',
        inputSchema: {
          start_date: dateSchema.optional().describe('Fecha inicial inclusiva.'),
          end_date: dateSchema.optional().describe('Fecha final inclusiva.'),
          type: z
            .enum(['income', 'expense', 'transfer', 'adjustment'])
            .optional()
            .describe('Tipo de movimiento.'),
          source: z
            .enum(['manual', 'import', 'email'])
            .optional()
            .describe('Origen del registro.'),
          account_id: z.string().uuid().optional().describe('ID exacto de una cuenta.'),
          category_id: z.string().uuid().optional().describe('ID exacto de una categoría.'),
          query: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .optional()
            .describe('Texto contenido en la nota del movimiento.'),
          minimum_amount: z.number().nonnegative().optional(),
          maximum_amount: z.number().nonnegative().optional(),
          limit: z.number().int().min(1).max(50).default(25),
        },
      },
      async (input, { authInfo }) => {
        try {
          return jsonContent(
            await searchTransactions(getMcpUserId(authInfo), input)
          )
        } catch (error) {
          return toolError(error)
        }
      }
    )

    server.registerTool(
      'compare_periods',
      {
        title: 'Comparar periodos',
        description:
          'Compara ingresos, gastos, flujo neto y categorías entre dos periodos de máximo 366 días cada uno.',
        inputSchema: {
          first_start_date: dateSchema,
          first_end_date: dateSchema,
          second_start_date: dateSchema,
          second_end_date: dateSchema,
        },
      },
      async (
        {
          first_start_date,
          first_end_date,
          second_start_date,
          second_end_date,
        },
        { authInfo }
      ) => {
        try {
          return jsonContent(
            await comparePeriods(
              getMcpUserId(authInfo),
              { start_date: first_start_date, end_date: first_end_date },
              { start_date: second_start_date, end_date: second_end_date }
            )
          )
        } catch (error) {
          return toolError(error)
        }
      }
    )

    server.registerTool(
      'list_accounts',
      {
        title: 'Listar cuentas',
        description:
          'Lista las cuentas financieras y sus saldos calculados. Omite cuentas archivadas salvo que se soliciten.',
        inputSchema: {
          include_archived: z.boolean().default(false),
        },
      },
      async ({ include_archived }, { authInfo }) => {
        try {
          return jsonContent(
            await listAccounts(getMcpUserId(authInfo), include_archived)
          )
        } catch (error) {
          return toolError(error)
        }
      }
    )
  },
  {},
  {
    basePath: '/api',
    maxDuration: 30,
    verboseLogs: false,
  }
)

const authenticatedHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  requiredScopes: [MCP_READ_SCOPE],
})

async function mcpRequestHandler(request: Request) {
  const response = await authenticatedHandler(request)
  const challenge = response.headers.get('WWW-Authenticate')

  if ((response.status === 401 || response.status === 403) && challenge) {
    response.headers.set(
      'WWW-Authenticate',
      challenge.includes('scope=')
        ? challenge
        : `${challenge}, scope="${MCP_READ_SCOPE}"`
    )
  }

  return response
}

export { mcpRequestHandler as GET, mcpRequestHandler as POST }
