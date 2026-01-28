export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          limit_credit: number | null
          name: string
          observations: string | null
          phone: string | null
          state: string | null
          status: string | null
          tax_id: string | null
          type: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          limit_credit?: number | null
          name: string
          observations?: string | null
          phone?: string | null
          state?: string | null
          status?: string | null
          tax_id?: string | null
          type?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          limit_credit?: number | null
          name?: string
          observations?: string | null
          phone?: string | null
          state?: string | null
          status?: string | null
          tax_id?: string | null
          type?: string | null
        }
        Relationships: []
      }
      financial_records: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          due_date: string
          entity_name: string | null
          id: string
          payment_date: string | null
          purchase_order_id: string | null
          sale_id: string | null
          status: string | null
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          due_date: string
          entity_name?: string | null
          id?: string
          payment_date?: string | null
          purchase_order_id?: string | null
          sale_id?: string | null
          status?: string | null
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          due_date?: string
          entity_name?: string | null
          id?: string
          payment_date?: string | null
          purchase_order_id?: string | null
          sale_id?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_orders: {
        Row: {
          code: string | null
          created_at: string | null
          end_date: string | null
          id: string
          product_id: string | null
          quantity: number
          start_date: string | null
          status: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          product_id?: string | null
          quantity: number
          start_date?: string | null
          status?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          date: string
          id: string
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          type: string
        }
        Insert: {
          date?: string
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          type: string
        }
        Update: {
          date?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          current_stock: number
          description: string | null
          id: string
          min_stock: number
          name: string
          price_cost: number | null
          price_sale: number | null
          sku: string | null
          status: string | null
          type: string
          unit: string
          validity_days: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          min_stock?: number
          name: string
          price_cost?: number | null
          price_sale?: number | null
          sku?: string | null
          status?: string | null
          type: string
          unit: string
          validity_days?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          min_stock?: number
          name?: string
          price_cost?: number | null
          price_sale?: number | null
          sku?: string | null
          status?: string | null
          type?: string
          unit?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          id: string
          product_id: string | null
          purchase_order_id: string | null
          quantity: number
          total: number
          unit_cost: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity: number
          total: number
          unit_cost: number
        }
        Update: {
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity?: number
          total?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          code: string | null
          created_at: string
          expected_delivery_date: string | null
          id: string
          observations: string | null
          order_date: string | null
          status: string | null
          supplier_id: string | null
          total_amount: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          observations?: string | null
          order_date?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          observations?: string | null
          order_date?: string | null
          status?: string | null
          supplier_id?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          product_id: string | null
          quantity: number
          sale_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          quantity: number
          sale_id?: string | null
          total: number
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          client_id: string | null
          code: string | null
          created_at: string
          discount_amount: number | null
          gross_amount: number | null
          id: string
          observations: string | null
          payment_method: string | null
          status: string | null
          total_amount: number | null
        }
        Insert: {
          client_id?: string | null
          code?: string | null
          created_at?: string
          discount_amount?: number | null
          gross_amount?: number | null
          id?: string
          observations?: string | null
          payment_method?: string | null
          status?: string | null
          total_amount?: number | null
        }
        Update: {
          client_id?: string | null
          code?: string | null
          created_at?: string
          discount_amount?: number | null
          gross_amount?: number | null
          id?: string
          observations?: string | null
          payment_method?: string | null
          status?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          observations: string | null
          phone: string | null
          state: string | null
          status: string | null
          tax_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          observations?: string | null
          phone?: string | null
          state?: string | null
          status?: string | null
          tax_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          observations?: string | null
          phone?: string | null
          state?: string | null
          status?: string | null
          tax_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_movement:
        | {
            Args: { p_product_id: string; p_quantity: number; p_type: string }
            Returns: undefined
          }
        | {
            Args: {
              p_product_id: string
              p_quantity: number
              p_reason?: string
              p_reference_id?: string
              p_type: string
            }
            Returns: undefined
          }
      apply_stock_adjustment: {
        Args: {
          p_delta: number
          p_product_id: string
          p_reason?: string
          p_reference_id?: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      item_type: "raw_material" | "finished_product"
      item_unit: "kg" | "lt" | "un" | "m"
      production_status: "draft" | "confirmed" | "canceled"
      stock_movement_type:
        | "purchase"
        | "sale"
        | "adjustment"
        | "production_in"
        | "production_out"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      item_type: ["raw_material", "finished_product"],
      item_unit: ["kg", "lt", "un", "m"],
      production_status: ["draft", "confirmed", "canceled"],
      stock_movement_type: [
        "purchase",
        "sale",
        "adjustment",
        "production_in",
        "production_out",
      ],
    },
  },
} as const
