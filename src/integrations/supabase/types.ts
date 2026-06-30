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
      driver_documents: {
        Row: {
          comment: string | null
          driver_id: string
          file_path: string
          id: string
          kind: Database["public"]["Enums"]["driver_doc_kind"]
          mime_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["driver_doc_status"]
          uploaded_at: string
        }
        Insert: {
          comment?: string | null
          driver_id: string
          file_path: string
          id?: string
          kind: Database["public"]["Enums"]["driver_doc_kind"]
          mime_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["driver_doc_status"]
          uploaded_at?: string
        }
        Update: {
          comment?: string | null
          driver_id?: string
          file_path?: string
          id?: string
          kind?: Database["public"]["Enums"]["driver_doc_kind"]
          mime_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["driver_doc_status"]
          uploaded_at?: string
        }
        Relationships: []
      }
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
          admin_comment: string | null
          application_status: Database["public"]["Enums"]["driver_app_status"]
          child_seat: boolean
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          last_seen_at: string | null
          license_number: string | null
          license_photo_path: string | null
          patronymic: string | null
          rating: number
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          status: Database["public"]["Enums"]["driver_status"]
          submitted_at: string | null
          total_rides: number
          updated_at: string
          vehicle_color: string | null
          vehicle_country: string | null
          vehicle_doc_path: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          verification: Database["public"]["Enums"]["driver_verification"]
        }
        Insert: {
          admin_comment?: string | null
          application_status?: Database["public"]["Enums"]["driver_app_status"]
          child_seat?: boolean
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          last_seen_at?: string | null
          license_number?: string | null
          license_photo_path?: string | null
          patronymic?: string | null
          rating?: number
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          submitted_at?: string | null
          total_rides?: number
          updated_at?: string
          vehicle_color?: string | null
          vehicle_country?: string | null
          vehicle_doc_path?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          verification?: Database["public"]["Enums"]["driver_verification"]
        }
        Update: {
          admin_comment?: string | null
          application_status?: Database["public"]["Enums"]["driver_app_status"]
          child_seat?: boolean
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_seen_at?: string | null
          license_number?: string | null
          license_photo_path?: string | null
          patronymic?: string | null
          rating?: number
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          submitted_at?: string | null
          total_rides?: number
          updated_at?: string
          vehicle_color?: string | null
          vehicle_country?: string | null
          vehicle_doc_path?: string | null
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
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          full_name: string | null
          gender: string | null
          id: string
          iin: string | null
          last_name: string | null
          live_photo_url: string | null
          patronymic: string | null
          phone: string | null
          rating: number
          selfie_path: string | null
          updated_at: string
          verification_comment: string | null
          verification_status: Database["public"]["Enums"]["verify_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          iin?: string | null
          last_name?: string | null
          live_photo_url?: string | null
          patronymic?: string | null
          phone?: string | null
          rating?: number
          selfie_path?: string | null
          updated_at?: string
          verification_comment?: string | null
          verification_status?: Database["public"]["Enums"]["verify_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          iin?: string | null
          last_name?: string | null
          live_photo_url?: string | null
          patronymic?: string | null
          phone?: string | null
          rating?: number
          selfie_path?: string | null
          updated_at?: string
          verification_comment?: string | null
          verification_status?: Database["public"]["Enums"]["verify_status"]
          verified_at?: string | null
          verified_by?: string | null
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
          estimated_fare: number | null
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
          tariff: Database["public"]["Enums"]["ride_tariff"]
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
          estimated_fare?: number | null
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
          tariff?: Database["public"]["Enums"]["ride_tariff"]
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
          estimated_fare?: number | null
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
          tariff?: Database["public"]["Enums"]["ride_tariff"]
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
      verification_requests: {
        Row: {
          ai_confidence: number | null
          ai_reason: string | null
          created_at: string
          date_of_birth: string | null
          document_path: string | null
          full_name: string | null
          gender: string | null
          id: string
          iin: string | null
          kind: Database["public"]["Enums"]["verify_kind"]
          license_photo_path: string | null
          reviewed_at: string | null
          reviewer_comment: string | null
          reviewer_id: string | null
          selfie_path: string
          status: Database["public"]["Enums"]["verify_status"]
          updated_at: string
          user_id: string
          vehicle_doc_path: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_reason?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_path?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          iin?: string | null
          kind: Database["public"]["Enums"]["verify_kind"]
          license_photo_path?: string | null
          reviewed_at?: string | null
          reviewer_comment?: string | null
          reviewer_id?: string | null
          selfie_path: string
          status?: Database["public"]["Enums"]["verify_status"]
          updated_at?: string
          user_id: string
          vehicle_doc_path?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_reason?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_path?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          iin?: string | null
          kind?: Database["public"]["Enums"]["verify_kind"]
          license_photo_path?: string | null
          reviewed_at?: string | null
          reviewer_comment?: string | null
          reviewer_id?: string | null
          selfie_path?: string
          status?: Database["public"]["Enums"]["verify_status"]
          updated_at?: string
          user_id?: string
          vehicle_doc_path?: string | null
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
      _upsert_driver_doc: {
        Args: {
          _kind: Database["public"]["Enums"]["driver_doc_kind"]
          _mime: string
          _path: string
          _user: string
        }
        Returns: undefined
      }
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
          estimated_fare: number | null
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
          tariff: Database["public"]["Enums"]["ride_tariff"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_block_user: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      admin_review_document: {
        Args: { _comment: string; _decision: string; _doc_id: string }
        Returns: {
          comment: string | null
          driver_id: string
          file_path: string
          id: string
          kind: Database["public"]["Enums"]["driver_doc_kind"]
          mime_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["driver_doc_status"]
          uploaded_at: string
        }
        SetofOptions: {
          from: "*"
          to: "driver_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_verification: {
        Args: { _comment: string; _decision: string; _request_id: string }
        Returns: {
          ai_confidence: number | null
          ai_reason: string | null
          created_at: string
          date_of_birth: string | null
          document_path: string | null
          full_name: string | null
          gender: string | null
          id: string
          iin: string | null
          kind: Database["public"]["Enums"]["verify_kind"]
          license_photo_path: string | null
          reviewed_at: string | null
          reviewer_comment: string | null
          reviewer_id: string | null
          selfie_path: string
          status: Database["public"]["Enums"]["verify_status"]
          updated_at: string
          user_id: string
          vehicle_doc_path: string | null
        }
        SetofOptions: {
          from: "*"
          to: "verification_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_unblock_user: { Args: { _user_id: string }; Returns: undefined }
      complete_ride:
        | {
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
              estimated_fare: number | null
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
              tariff: Database["public"]["Enums"]["ride_tariff"]
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "rides"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _distance: number
              _duration: number
              _fare: number
              _lat?: number
              _lng?: number
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
              estimated_fare: number | null
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
              tariff: Database["public"]["Enums"]["ride_tariff"]
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "rides"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      dispatch_ride: { Args: { _ride_id: string }; Returns: string }
      expire_offers_and_redispatch: { Args: never; Returns: number }
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
      rate_ride: {
        Args: { _comment?: string; _rating: number; _ride_id: string }
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
          estimated_fare: number | null
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
          tariff: Database["public"]["Enums"]["ride_tariff"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
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
      reupload_driver_document: {
        Args: {
          _kind: Database["public"]["Enums"]["driver_doc_kind"]
          _mime: string
          _path: string
        }
        Returns: {
          comment: string | null
          driver_id: string
          file_path: string
          id: string
          kind: Database["public"]["Enums"]["driver_doc_kind"]
          mime_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["driver_doc_status"]
          uploaded_at: string
        }
        SetofOptions: {
          from: "*"
          to: "driver_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_driver_application: {
        Args: {
          _child_seat: boolean
          _identity_mime: string
          _identity_path: string
          _license_mime: string
          _license_path: string
          _vehicle_country: string
          _vehicle_documents_mime: string
          _vehicle_documents_path: string
          _vehicle_plate: string
        }
        Returns: {
          admin_comment: string | null
          application_status: Database["public"]["Enums"]["driver_app_status"]
          child_seat: boolean
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          last_seen_at: string | null
          license_number: string | null
          license_photo_path: string | null
          patronymic: string | null
          rating: number
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          status: Database["public"]["Enums"]["driver_status"]
          submitted_at: string | null
          total_rides: number
          updated_at: string
          vehicle_color: string | null
          vehicle_country: string | null
          vehicle_doc_path: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          verification: Database["public"]["Enums"]["driver_verification"]
        }
        SetofOptions: {
          from: "*"
          to: "drivers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_driver_verification: {
        Args: {
          _ai_confidence: number
          _ai_reason: string
          _license_path: string
          _selfie_path: string
          _vehicle_doc_path: string
        }
        Returns: {
          ai_confidence: number | null
          ai_reason: string | null
          created_at: string
          date_of_birth: string | null
          document_path: string | null
          full_name: string | null
          gender: string | null
          id: string
          iin: string | null
          kind: Database["public"]["Enums"]["verify_kind"]
          license_photo_path: string | null
          reviewed_at: string | null
          reviewer_comment: string | null
          reviewer_id: string | null
          selfie_path: string
          status: Database["public"]["Enums"]["verify_status"]
          updated_at: string
          user_id: string
          vehicle_doc_path: string | null
        }
        SetofOptions: {
          from: "*"
          to: "verification_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_passenger_verification: {
        Args: {
          _ai_confidence: number
          _ai_reason: string
          _dob: string
          _full_name: string
          _gender: string
          _iin: string
          _selfie_path: string
        }
        Returns: {
          ai_confidence: number | null
          ai_reason: string | null
          created_at: string
          date_of_birth: string | null
          document_path: string | null
          full_name: string | null
          gender: string | null
          id: string
          iin: string | null
          kind: Database["public"]["Enums"]["verify_kind"]
          license_photo_path: string | null
          reviewed_at: string | null
          reviewer_comment: string | null
          reviewer_id: string | null
          selfie_path: string
          status: Database["public"]["Enums"]["verify_status"]
          updated_at: string
          user_id: string
          vehicle_doc_path: string | null
        }
        SetofOptions: {
          from: "*"
          to: "verification_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      topup_wallet: {
        Args: { _amount: number; _card_last4: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "passenger" | "driver" | "admin"
      driver_app_status: "pending" | "needs_reupload" | "approved" | "rejected"
      driver_doc_kind:
        | "identity"
        | "license"
        | "vehicle_registration"
        | "vehicle_documents"
      driver_doc_status: "pending" | "approved" | "rejected"
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
      ride_tariff: "standard" | "kids"
      tx_status: "pending" | "completed" | "failed" | "cancelled"
      tx_type:
        | "ride_earning"
        | "commission"
        | "withdrawal"
        | "topup"
        | "refund"
        | "adjustment"
      verify_kind: "passenger" | "driver"
      verify_status:
        | "pending"
        | "auto_approved"
        | "manual_review"
        | "approved"
        | "rejected"
        | "reupload_requested"
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
      driver_app_status: ["pending", "needs_reupload", "approved", "rejected"],
      driver_doc_kind: [
        "identity",
        "license",
        "vehicle_registration",
        "vehicle_documents",
      ],
      driver_doc_status: ["pending", "approved", "rejected"],
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
      ride_tariff: ["standard", "kids"],
      tx_status: ["pending", "completed", "failed", "cancelled"],
      tx_type: [
        "ride_earning",
        "commission",
        "withdrawal",
        "topup",
        "refund",
        "adjustment",
      ],
      verify_kind: ["passenger", "driver"],
      verify_status: [
        "pending",
        "auto_approved",
        "manual_review",
        "approved",
        "rejected",
        "reupload_requested",
      ],
      withdrawal_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const
