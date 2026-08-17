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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          created_at: string
          id: string
          is_default: boolean | null
          label: string | null
          line1: string
          line2: string | null
          mobile: string
          pincode: string
          recipient_name: string
          state: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          line1: string
          line2?: string | null
          mobile: string
          pincode: string
          recipient_name: string
          state: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          line1?: string
          line2?: string | null
          mobile?: string
          pincode?: string
          recipient_name?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_reset_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          remark: string | null
          size: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          remark?: string | null
          size?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          remark?: string | null
          size?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          image_url: string | null
          name: string
          product_count: number | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          product_count?: number | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          product_count?: number | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      category_subcategories: {
        Row: {
          category_id: string
          subcategory_id: string
        }
        Insert: {
          category_id: string
          subcategory_id: string
        }
        Update: {
          category_id?: string
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_subcategories_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      enquiries: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string
          phone: string
          product_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name: string
          phone: string
          product_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      expo_push_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gold_rates: {
        Row: {
          created_at: string
          gold_18k: number
          gold_22k: number
          gold_24k: number
          id: string
          rate_date: string
          silver: number
        }
        Insert: {
          created_at?: string
          gold_18k: number
          gold_22k: number
          gold_24k: number
          id?: string
          rate_date: string
          silver: number
        }
        Update: {
          created_at?: string
          gold_18k?: number
          gold_22k?: number
          gold_24k?: number
          id?: string
          rate_date?: string
          silver?: number
        }
        Relationships: []
      }
      item_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_item_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_item_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_item_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "item_status_history_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          gross_weight: number | null
          id: string
          image_url: string | null
          net_weight: number | null
          order_id: string
          product_id: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          remark: string | null
          shipment_id: string | null
          size: string | null
          status: Database["public"]["Enums"]["order_status"]
          status_updated_at: string
          unit_price: number
        }
        Insert: {
          gross_weight?: number | null
          id?: string
          image_url?: string | null
          net_weight?: number | null
          order_id: string
          product_id?: string | null
          product_name: string
          product_sku?: string | null
          quantity: number
          remark?: string | null
          shipment_id?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_updated_at?: string
          unit_price: number
        }
        Update: {
          gross_weight?: number | null
          id?: string
          image_url?: string | null
          net_weight?: number | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          remark?: string | null
          shipment_id?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_updated_at?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_address: string | null
          customer_city: string | null
          customer_email: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_pincode: string | null
          gst: number
          id: string
          making_charges: number
          order_no: string
          payment_method: string | null
          payment_status: string | null
          shipping_address: Json
          stage_history: Json
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_pincode?: string | null
          gst?: number
          id?: string
          making_charges?: number
          order_no?: string
          payment_method?: string | null
          payment_status?: string | null
          shipping_address: Json
          stage_history?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_pincode?: string | null
          gst?: number
          id?: string
          making_charges?: number
          order_no?: string
          payment_method?: string | null
          payment_status?: string | null
          shipping_address?: Json
          stage_history?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          collection_id: string | null
          created_at: string
          description: string | null
          design_no: string | null
          family: string | null
          gross_weight: number
          has_image: boolean
          homepage_featured: boolean
          homepage_featured_order: number | null
          id: string
          image_path: string | null
          image_url: string | null
          image_variants: Json | null
          images: string[] | null
          import_status: string
          in_stock: boolean | null
          is_bestseller: boolean | null
          is_new: boolean | null
          is_trending: boolean | null
          item: string | null
          label_code: string | null
          low_stock_threshold: number
          making_charge_pct: number | null
          metal: Database["public"]["Enums"]["metal_type"]
          moq: number | null
          name: string
          net_weight: number
          occasion: string | null
          price: number
          purity: string
          sizes: string[] | null
          sku: string
          slug: string
          stock_quantity: number
          stone_type: string | null
          stone_weight: number | null
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          collection_id?: string | null
          created_at?: string
          description?: string | null
          design_no?: string | null
          family?: string | null
          gross_weight: number
          has_image?: boolean
          homepage_featured?: boolean
          homepage_featured_order?: number | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          image_variants?: Json | null
          images?: string[] | null
          import_status?: string
          in_stock?: boolean | null
          is_bestseller?: boolean | null
          is_new?: boolean | null
          is_trending?: boolean | null
          item?: string | null
          label_code?: string | null
          low_stock_threshold?: number
          making_charge_pct?: number | null
          metal?: Database["public"]["Enums"]["metal_type"]
          moq?: number | null
          name: string
          net_weight: number
          occasion?: string | null
          price?: number
          purity?: string
          sizes?: string[] | null
          sku: string
          slug: string
          stock_quantity?: number
          stone_type?: string | null
          stone_weight?: number | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          collection_id?: string | null
          created_at?: string
          description?: string | null
          design_no?: string | null
          family?: string | null
          gross_weight?: number
          has_image?: boolean
          homepage_featured?: boolean
          homepage_featured_order?: number | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          image_variants?: Json | null
          images?: string[] | null
          import_status?: string
          in_stock?: boolean | null
          is_bestseller?: boolean | null
          is_new?: boolean | null
          is_trending?: boolean | null
          item?: string | null
          label_code?: string | null
          low_stock_threshold?: number
          making_charge_pct?: number | null
          metal?: Database["public"]["Enums"]["metal_type"]
          moq?: number | null
          name?: string
          net_weight?: number
          occasion?: string | null
          price?: number
          purity?: string
          sizes?: string[] | null
          sku?: string
          slug?: string
          stock_quantity?: number
          stone_type?: string | null
          stone_weight?: number | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          additional_remarks: string | null
          business_name: string | null
          business_type: Database["public"]["Enums"]["business_type"] | null
          city: string | null
          contact_person: string | null
          created_at: string
          delivery_address: string | null
          email: string | null
          full_name: string | null
          gstin: string | null
          id: string
          mobile: string | null
          must_change_password: boolean
          profile_completed: boolean
          status: string
          updated_at: string
          username: string | null
        }
        Insert: {
          additional_remarks?: string | null
          business_name?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          delivery_address?: string | null
          email?: string | null
          full_name?: string | null
          gstin?: string | null
          id: string
          mobile?: string | null
          must_change_password?: boolean
          profile_completed?: boolean
          status?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          additional_remarks?: string | null
          business_name?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          delivery_address?: string | null
          email?: string | null
          full_name?: string | null
          gstin?: string | null
          id?: string
          mobile?: string | null
          must_change_password?: boolean
          profile_completed?: boolean
          status?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          courier: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          dispatched_at: string | null
          id: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          courier?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          dispatched_at?: string | null
          id?: string
          order_id: string
          status?: Database["public"]["Enums"]["order_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          courier?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          dispatched_at?: string | null
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          action_type: Database["public"]["Enums"]["stock_action_type"] | null
          created_at: string
          created_by: string | null
          delta: number
          id: string
          new_qty: number
          previous_qty: number
          product_id: string
          reason: string | null
        }
        Insert: {
          action_type?: Database["public"]["Enums"]["stock_action_type"] | null
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          new_qty: number
          previous_qty: number
          product_id: string
          reason?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["stock_action_type"] | null
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          new_qty?: number
          previous_qty?: number
          product_id?: string
          reason?: string | null
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
      subcategories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta: Json
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_category_product_counts: {
        Args: { _slugs: string[] }
        Returns: {
          product_count: number
          slug: string
        }[]
      }
      get_subcategory_product_counts: {
        Args: { _category_id: string }
        Returns: {
          product_count: number
          subcategory_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      business_type: "retailer" | "wholesaler" | "individual"
      metal_type: "gold" | "silver" | "platinum" | "diamond"
      order_status:
        | "placed"
        | "processing"
        | "ready"
        | "dispatched"
        | "delivered"
        | "cancelled"
        | "pending"
        | "accepted"
        | "rejected"
        | "confirmed"
        | "out_for_delivery"
      stock_action_type: "increment" | "decrement" | "edit" | "created" | "set"
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
      app_role: ["admin", "customer"],
      business_type: ["retailer", "wholesaler", "individual"],
      metal_type: ["gold", "silver", "platinum", "diamond"],
      order_status: [
        "placed",
        "processing",
        "ready",
        "dispatched",
        "delivered",
        "cancelled",
        "pending",
        "accepted",
        "rejected",
        "confirmed",
        "out_for_delivery",
      ],
      stock_action_type: ["increment", "decrement", "edit", "created", "set"],
    },
  },
} as const
