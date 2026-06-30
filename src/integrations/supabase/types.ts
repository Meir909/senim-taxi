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
      driver_locations: {
        Row: {
          accuracy: number | null
          driver_id: string
          heading: number | null
          lat: number
          lng: number
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          driver_id: string
          heading?: number | null
          lat: number
          lng: number
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          driver_id?: string
          heading?: number | null
          lat?: number
          lng?: number
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string | null
          license_number: string | null
          rating: number
          status: Database["public"]["Enums"]["driver_status"]
          total_rides: number
          updated_at: string
          vehicle_color: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          verification: Database["public"]["Enums"]["driver_verification"]
        }
        Insert: {
          created_at?: string
          id: string
          last_seen_at?: string | null
          license_number?: string | null
          rating?: number
          status?: Database["public"]["Enums"]["driver_status"]
          total_rides?: number
          updated_at?: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          verification?: Database["public"]["Enums"]["driver_verification"]
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          license_number?: string | null
          rating?: number
          status?: Database["public"]["Enums"]["driver_status"]
          total_rides?: number
          updated_at?: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          verification?: Database["public"]["Enums"]["driver_verification"]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ride_offers: {
        Row: {
          created_at: string
          distance_km: number | null
          driver_id: string
          expires_at: string
          id: string
          responded_at: string | null
          ride_id: string
          status: Database["public"]["Enums"]["ride_offer_status"]
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          driver_id: string
          expires_at: string
          id?: string
          responded_at?: string | null
          ride_id: string
          status?: Database["public"]["Enums"]["ride_offer_status"]
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          driver_id?: string
          expires_at?: string
          id?: string
          responded_at?: string | null
          ride_id?: string
          status?: Database["public"]["Enums"]["ride_offer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_offers_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          commission_amount: number | null
          completed_at: string | null
          distance_km: number | null
          driver_id: string | null
          driver_rating: number | null
          dropoff_address: string | null
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number | null
          fare_amount: number | null
          id: string
          passenger_id: string
          passenger_rating: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pickup_address: string | null
          pickup_lat: number
          pickup_lng: number
          requested_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          commission_amount?: number | null
          completed_at?: string | null
          distance_km?: number | null
          driver_id?: string | null
          driver_rating?: number | null
          dropoff_address?: string | null
          dropoff_lat: number
          dropoff_lng: number
          duration_min?: number | null
          fare_amount?: number | null
          id?: string
          passenger_id: string
          passenger_rating?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup_address?: string | null
          pickup_lat: number
          pickup_lng: number
          requested_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          commission_amount?: number | null
          completed_at?: string | null
          distance_km?: number | null
          driver_id?: string | null
          driver_rating?: number | null
          dropoff_address?: string | null
          dropoff_lat?: number
          dropoff_lng?: number
          duration_min?: number | null
          fare_amount?: number | null
          id?: string
          passenger_id?: string
          passenger_rating?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup_address?: string | null
          pickup_lat?: number
          pickup_lng?: number
          requested_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json
          ride_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          ride_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          ride_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          currency: string
          pending_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          currency?: string
          pending_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          currency?: string
          pending_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          card_holder: string | null
          card_last4: string | null
          created_at: string
          driver_id: string
          id: string
          notes: string | null
          processed_at: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
        }
        Insert: {
          amount: number
          card_holder?: string | null
          card_last4?: string | null
          created_at?: string
          driver_id: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
        }
        Update: {
          amount?: number
          card_holder?: string | null
          card_last4?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_ride_offer: {
        Args: { _offer_id: string }
        Returns: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          commission_amount: number | null
          completed_at: string | null
          distance_km: number | null
          driver_id: string | null
          driver_rating: number | null
          dropoff_address: string | null
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number | null
          fare_amount: number | null
          id: string
          passenger_id: string
          passenger_rating: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pickup_address: string | null
          pickup_lat: number
          pickup_lng: number
          requested_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_ride: {
        Args: {
          _distance: number
          _duration: number
          _fare: number
          _ride_id: string
        }
        Returns: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          commission_amount: number | null
          completed_at: string | null
          distance_km: number | null
          driver_id: string | null
          driver_rating: number | null
          dropoff_address: string | null
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number | null
          fare_amount: number | null
          id: string
          passenger_id: string
          passenger_rating: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pickup_address: string | null
          pickup_lat: number
          pickup_lng: number
          requested_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_nearby_drivers: {
        Args: { _lat: number; _lng: number; _radius_km?: number }
        Returns: {
          distance_km: number
          driver_id: string
          lat: number
          lng: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reject_ride_offer: { Args: { _offer_id: string }; Returns: undefined }
      request_withdrawal: {
        Args: { _amount: number; _card_holder: string; _card_last4: string }
        Returns: {
          amount: number
          card_holder: string | null
          card_last4: string | null
          created_at: string
          driver_id: string
          id: string
          notes: string | null
          processed_at: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "passenger" | "driver" | "admin"
      driver_status: "offline" | "online" | "on_ride"
      driver_verification: "pending" | "approved" | "rejected"
      payment_method: "cash" | "wallet" | "card_demo"
      ride_offer_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "timeout"
        | "cancelled"
      ride_status:
        | "requested"
        | "searching"
        | "accepted"
        | "driver_arriving"
        | "driver_arrived"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_drivers"
      tx_status: "pending" | "completed" | "failed" | "cancelled"
      tx_type:
        | "ride_earning"
        | "commission"
        | "withdrawal"
        | "topup"
        | "refund"
        | "adjustment"
      withdrawal_status: "pending" | "approved" | "rejected" | "paid"
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
      app_role: ["passenger", "driver", "admin"],
      driver_status: ["offline", "online", "on_ride"],
      driver_verification: ["pending", "approved", "rejected"],
      payment_method: ["cash", "wallet", "card_demo"],
      ride_offer_status: [
        "pending",
        "accepted",
        "rejected",
        "timeout",
        "cancelled",
      ],
      ride_status: [
        "requested",
        "searching",
        "accepted",
        "driver_arriving",
        "driver_arrived",
        "in_progress",
        "completed",
        "cancelled",
        "no_drivers",
      ],
      tx_status: ["pending", "completed", "failed", "cancelled"],
      tx_type: [
        "ride_earning",
        "commission",
        "withdrawal",
        "topup",
        "refund",
        "adjustment",
      ],
      withdrawal_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const
