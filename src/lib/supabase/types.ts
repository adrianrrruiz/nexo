// Tipos de la base de datos de Nexo.
// Se pueden regenerar desde el esquema real con:
//   supabase gen types typescript --local > src/lib/supabase/types.ts
// Por ahora se mantienen a mano para tener tipado en la app.

export type AccountType = 'debit' | 'savings' | 'credit' | 'cash'
export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment'
export type TransactionSource = 'manual' | 'import' | 'email'
export type CategoryKind = 'income' | 'expense'

export type Profile = {
  id: string
  full_name: string | null
  avatar_path: string | null
  created_at: string
  updated_at: string
}

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: string
  initial_balance: number
  credit_limit: number | null
  image_path: string | null
  color: string | null
  icon: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  kind: CategoryKind
  color: string | null
  icon: string | null
  is_suggested: boolean
  created_at: string
}

export type Transaction = {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  occurred_at: string
  account_id: string
  to_account_id: string | null
  category_id: string | null
  note: string | null
  source: TransactionSource
  external_ref: string | null
  import_batch_id: string | null
  created_at: string
  updated_at: string
}

export type AccountBalance = {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: string
  credit_limit: number | null
  image_path: string | null
  balance: number
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          full_name?: string | null
          avatar_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Profile>
        Relationships: []
      }
      accounts: {
        Row: Account
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: AccountType
          currency?: string
          initial_balance?: number
          credit_limit?: number | null
          image_path?: string | null
          color?: string | null
          icon?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Account>
        Relationships: []
      }
      categories: {
        Row: Category
        Insert: {
          id?: string
          user_id: string
          name: string
          parent_id?: string | null
          kind?: CategoryKind
          color?: string | null
          icon?: string | null
          is_suggested?: boolean
          created_at?: string
        }
        Update: Partial<Category>
        Relationships: []
      }
      transactions: {
        Row: Transaction
        Insert: {
          id?: string
          user_id: string
          type: TransactionType
          amount: number
          occurred_at?: string
          account_id: string
          to_account_id?: string | null
          category_id?: string | null
          note?: string | null
          source?: TransactionSource
          external_ref?: string | null
          import_batch_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Transaction>
        Relationships: []
      }
      import_batches: {
        Row: {
          id: string
          user_id: string
          source_file: string | null
          row_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_file?: string | null
          row_count?: number
          created_at?: string
        }
        Update: Partial<{
          source_file: string | null
          row_count: number
        }>
        Relationships: []
      }
    }
    Views: {
      account_balances: {
        Row: AccountBalance
        Relationships: []
      }
    }
    Functions: Record<never, never>
    Enums: {
      account_type: AccountType
      transaction_type: TransactionType
      transaction_source: TransactionSource
      category_kind: CategoryKind
    }
    CompositeTypes: Record<never, never>
  }
}
