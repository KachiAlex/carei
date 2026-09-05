-- CAREi Database Schema Export
-- Generated: 2026-09-04T13:26:55.192Z

CREATE TABLE IF NOT EXISTS "_migrations" (
  "id" integer NOT NULL,
  "name" text NOT NULL,
  "applied_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "_migrations_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "agencies" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "logo" text,
  "settings" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "tenant_id" text,
  CONSTRAINT "agencies_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text NOT NULL,
  "visit_id" text,
  "client_id" text,
  "carer_id" text,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "details" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "body_map_marks" (
  "id" text NOT NULL,
  "visit_id" text NOT NULL,
  "client_id" text,
  "carer_id" text,
  "x" integer NOT NULL,
  "y" integer NOT NULL,
  "side" text DEFAULT 'anterior'::text,
  "type" text DEFAULT 'skin_integrity'::text,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "tenant_id" text,
  CONSTRAINT "body_map_marks_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "care_plans" (
  "id" text NOT NULL,
  "client_id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "created_by" text,
  "updated_by" text,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "objectives" text[],
  "preventive" text[],
  "risks" text[],
  "post_med" text[],
  "last_review" text[],
  "pbs_triggers" text[],
  "safety_plan" text[],
  "pbs_calm_signs" text[],
  "pbs_calm_actions" text[],
  "pbs_anxious_signs" text[],
  "pbs_anxious_actions" text[],
  "pbs_risk_signs" text[],
  "pbs_risk_actions" text[],
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "published_at" timestamp with time zone,
  CONSTRAINT "care_plans_pkey" PRIMARY KEY (id)
);

ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id);

CREATE TABLE IF NOT EXISTS "caregiver_client_assignments" (
  "id" text NOT NULL,
  "caregiver_id" text NOT NULL,
  "client_id" text NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now(),
  "visit_date" date,
  "visit_time" text,
  "instructions" text,
  "tenant_id" text,
  CONSTRAINT "caregiver_client_assignments_pkey" PRIMARY KEY (id)
);

ALTER TABLE "caregiver_client_assignments" ADD CONSTRAINT "caregiver_client_assignments_caregiver_id_client_id_key" UNIQUE (caregiver_id, client_id);

CREATE TABLE IF NOT EXISTS "carer_availability" (
  "id" text NOT NULL,
  "tenant_id" text,
  "carer_id" text NOT NULL,
  "day_of_week" integer NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "is_available" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "carer_availability_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "carers" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'available'::text,
  "location" text,
  "client" text,
  "since" text,
  "avatar" text,
  CONSTRAINT "carers_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "clash_detection_settings" (
  "id" text NOT NULL,
  "tenant_id" text,
  "min_gap_minutes" integer DEFAULT 15,
  "check_travel_time" boolean DEFAULT false,
  "allow_override" boolean DEFAULT true,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "clash_detection_settings_pkey" PRIMARY KEY (id)
);

ALTER TABLE "clash_detection_settings" ADD CONSTRAINT "clash_detection_settings_tenant_id_key" UNIQUE (tenant_id);

CREATE TABLE IF NOT EXISTS "clients" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "age" integer,
  "address" text,
  "conditions" jsonb,
  "medications" jsonb,
  "preferences" text,
  "emergency_contact" text,
  "bp_baseline_systolic" integer,
  "bp_baseline_diastolic" integer,
  "pbs_framework" jsonb,
  "tenant_id" text,
  "allergies" text,
  "dysphagia_protocol" text,
  "support_framework" text,
  "communication_guidance" text,
  "mobility" text,
  "care_cues" jsonb,
  "tag_id" text,
  CONSTRAINT "clients_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text NOT NULL,
  "tenant_id" text,
  "participant1_id" text NOT NULL,
  "participant1_name" text,
  "participant1_role" text,
  "participant2_id" text NOT NULL,
  "participant2_name" text,
  "participant2_role" text,
  "last_message" text,
  "last_message_at" timestamp with time zone,
  "unread_count_1" integer DEFAULT 0,
  "unread_count_2" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "conversations_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "data_retention_policies" (
  "id" text NOT NULL,
  "tenant_id" text,
  "visit_draft_retention_days" integer DEFAULT 30,
  "completed_visit_retention_days" integer DEFAULT 365,
  "medication_log_retention_days" integer DEFAULT 365,
  "incident_retention_days" integer DEFAULT 2555,
  "voice_memo_retention_days" integer DEFAULT 90,
  "offline_queue_retention_hours" integer DEFAULT 72,
  "auto_purge_enabled" boolean DEFAULT true,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY (id)
);

ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_tenant_id_key" UNIQUE (tenant_id);

CREATE TABLE IF NOT EXISTS "dbs_checks" (
  "id" text NOT NULL,
  "tenant_id" text,
  "carer_id" text NOT NULL,
  "carer_name" text,
  "dbs_type" text DEFAULT 'standard'::text,
  "dbs_number" text,
  "issue_date" date,
  "expiry_date" date,
  "status" text DEFAULT 'valid'::text,
  "update_service" boolean DEFAULT false,
  "update_service_last_checked" date,
  "notes" text,
  "document_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "dbs_checks_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "device_wipe_commands" (
  "id" text NOT NULL,
  "tenant_id" text,
  "device_id" text NOT NULL,
  "user_id" text,
  "issued_by" text,
  "reason" text,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "executed_at" timestamp with time zone,
  CONSTRAINT "device_wipe_commands_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "drug_interactions" (
  "id" text NOT NULL,
  "drug_a" text NOT NULL,
  "drug_b" text NOT NULL,
  "severity" text DEFAULT 'moderate'::text,
  "description" text,
  "tenant_id" text,
  CONSTRAINT "drug_interactions_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "family_members" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "client_id" text NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "relationship" text NOT NULL,
  "role" text DEFAULT 'secondary'::text NOT NULL,
  "permissions" text[] DEFAULT '{}'::text[],
  "pin_hash" text,
  "token_hash" text,
  "token_expires_at" timestamp with time zone,
  "is_active" boolean DEFAULT true,
  "invited_by" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "last_login" timestamp with time zone,
  CONSTRAINT "family_members_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "family_messages" (
  "id" text NOT NULL,
  "visit_id" text,
  "client_id" text,
  "sender_name" text,
  "sender_role" text,
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "tenant_id" text,
  CONSTRAINT "family_messages_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "incidents" (
  "id" text NOT NULL,
  "carer_id" text,
  "carer_name" text,
  "client_id" text,
  "client_name" text,
  "type" text NOT NULL,
  "description" text,
  "severity" text DEFAULT 'medium'::text,
  "timestamp" timestamp with time zone DEFAULT now(),
  "resolved" boolean DEFAULT false,
  "visit_id" text,
  "tenant_id" text,
  CONSTRAINT "incidents_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" text NOT NULL,
  "tenant_id" text,
  "carer_id" text NOT NULL,
  "carer_name" text,
  "leave_type" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "reason" text,
  "status" text DEFAULT 'pending'::text,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "leave_requests_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "medication_logs" (
  "id" text NOT NULL,
  "client_id" text,
  "client_name" text,
  "carer_id" text,
  "carer_name" text,
  "medication_name" text NOT NULL,
  "dose" text,
  "scheduled_time" text,
  "status" text DEFAULT 'pending'::text,
  "reason" text,
  "timestamp" timestamp with time zone DEFAULT now(),
  "caregiver_id" text,
  "visit_id" text,
  "administered_at" timestamp with time zone DEFAULT now(),
  "witness_name" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "tenant_id" text,
  CONSTRAINT "medication_logs_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "messages" (
  "id" text NOT NULL,
  "tenant_id" text,
  "conversation_id" text NOT NULL,
  "sender_id" text NOT NULL,
  "sender_name" text,
  "sender_role" text,
  "body" text NOT NULL,
  "priority" text DEFAULT 'normal'::text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "messages_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "otp_codes" (
  "id" text NOT NULL,
  "email" text NOT NULL,
  "code" text NOT NULL,
  "purpose" text DEFAULT 'login'::text,
  "expires_at" timestamp with time zone NOT NULL,
  "used" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "otp_codes_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "plans" (
  "id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "max_users" integer NOT NULL,
  "max_clients" integer NOT NULL,
  "price_per_carer" numeric DEFAULT 0,
  "billing_model" text DEFAULT 'per-carer'::text,
  "is_default" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "plans_pkey" PRIMARY KEY (id)
);

ALTER TABLE "plans" ADD CONSTRAINT "plans_slug_key" UNIQUE (slug);

CREATE TABLE IF NOT EXISTS "right_to_work_checks" (
  "id" text NOT NULL,
  "tenant_id" text,
  "carer_id" text NOT NULL,
  "carer_name" text,
  "check_type" text,
  "passport_number" text,
  "passport_expiry" date,
  "share_code" text,
  "share_code_expiry" date,
  "nationality" text,
  "visa_type" text,
  "visa_expiry" date,
  "work_restriction" text,
  "document_urls" jsonb,
  "verification_status" text DEFAULT 'pending'::text,
  "verified_by" text,
  "verified_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "right_to_work_checks_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "scheduled_visits" (
  "id" text NOT NULL,
  "client_id" text,
  "client_name" text NOT NULL,
  "carer_id" text,
  "carer_name" text,
  "time" text,
  "duration" text,
  "status" text DEFAULT 'pending'::text,
  "tasks" jsonb,
  "flags" jsonb,
  "recurring" text DEFAULT 'none'::text,
  "visit_date" date DEFAULT CURRENT_DATE,
  "tenant_id" text,
  "recurrence_end_date" date,
  "recurrence_parent_id" text,
  CONSTRAINT "scheduled_visits_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "sos_alerts" (
  "id" text NOT NULL,
  "visit_id" text,
  "location" text,
  "timestamp" timestamp with time zone DEFAULT now(),
  "resolved" boolean DEFAULT false,
  "tenant_id" text,
  CONSTRAINT "sos_alerts_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "supervisions" (
  "id" text NOT NULL,
  "tenant_id" text,
  "carer_id" text NOT NULL,
  "carer_name" text,
  "manager_id" text,
  "manager_name" text,
  "type" text DEFAULT 'supervision'::text NOT NULL,
  "scheduled_date" date NOT NULL,
  "scheduled_time" text,
  "duration_minutes" integer DEFAULT 60,
  "location" text,
  "status" text DEFAULT 'scheduled'::text,
  "agenda" text,
  "notes" text,
  "action_items" jsonb,
  "rating" integer,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "supervisions_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "task_logs" (
  "id" text NOT NULL,
  "client_id" text NOT NULL,
  "caregiver_id" text NOT NULL,
  "task_name" text NOT NULL,
  "start_time" timestamp with time zone,
  "complete_time" timestamp with time zone,
  "notes" text,
  "duration_minutes" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "tenant_id" text,
  CONSTRAINT "task_logs_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text NOT NULL,
  "client_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "frequency" text DEFAULT 'daily'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "tenant_id" text,
  CONSTRAINT "tasks_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "tenant_users" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text DEFAULT 'carer'::text NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "tenant_users_pkey" PRIMARY KEY (id)
);

ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_user_id_key" UNIQUE (tenant_id, user_id);
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "domain" text,
  "plan" text DEFAULT 'trial'::text,
  "settings" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "max_users" integer,
  "max_clients" integer,
  "active" boolean DEFAULT true,
  "expires_at" timestamp with time zone,
  "subscription_status" text DEFAULT 'active'::text,
  "price_per_carer" numeric,
  "billing_model" text DEFAULT 'per-carer'::text,
  CONSTRAINT "tenants_pkey" PRIMARY KEY (id)
);

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_key" UNIQUE (slug);

CREATE TABLE IF NOT EXISTS "training_certifications" (
  "id" text NOT NULL,
  "tenant_id" text,
  "carer_id" text NOT NULL,
  "carer_name" text,
  "course_name" text NOT NULL,
  "category" text,
  "provider" text,
  "completion_date" date,
  "expiry_date" date,
  "certificate_number" text,
  "status" text DEFAULT 'valid'::text,
  "score" text,
  "notes" text,
  "document_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "training_certifications_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "travel_logs" (
  "id" text NOT NULL,
  "tenant_id" text,
  "carer_id" text NOT NULL,
  "from_client_id" text,
  "from_client_name" text,
  "from_address" text,
  "to_client_id" text,
  "to_client_name" text,
  "to_address" text,
  "visit_date" date NOT NULL,
  "distance_meters" real,
  "travel_time_seconds" integer,
  "estimated_mode" text DEFAULT 'driving'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "travel_logs_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "users" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "region" text NOT NULL,
  "pin" text,
  "role" text DEFAULT 'carer'::text NOT NULL,
  "token" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "status" text DEFAULT 'active'::text,
  "agency_id" text,
  "password_hash" text,
  "tenant_id" text,
  "biometrics_enabled" boolean DEFAULT false,
  "webauthn_credential" text,
  "pin_hash" text,
  "password_hash_scrypt" text,
  "token_hash" text,
  "token_expires_at" timestamp with time zone,
  "email_verified" boolean DEFAULT false,
  "phone_verified" boolean DEFAULT false,
  "refresh_token_hash" text,
  "refresh_token_expires_at" timestamp with time zone,
  CONSTRAINT "users_pkey" PRIMARY KEY (id)
);

ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE (email);

CREATE TABLE IF NOT EXISTS "visit_drafts" (
  "visit_id" text NOT NULL,
  "data" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  "tenant_id" text,
  CONSTRAINT "visit_drafts_pkey" PRIMARY KEY (visit_id)
);


CREATE TABLE IF NOT EXISTS "visits" (
  "id" text NOT NULL,
  "client_name" text NOT NULL,
  "client_age" integer,
  "client_address" text,
  "visit_time" text,
  "visit_duration" text,
  "elapsed" integer,
  "tasks" jsonb,
  "fluid" integer,
  "notes" text,
  "medications" jsonb,
  "handover_note" text,
  "clock_out_at" timestamp with time zone,
  "submitted_at" timestamp with time zone DEFAULT now(),
  "bp_systolic" integer,
  "bp_diastolic" integer,
  "pulse" integer,
  "o2_sat" integer,
  "fluid_glasses" integer,
  "meal_status" text,
  "mood" text,
  "wellbeing_note" text,
  "client_id" text,
  "clock_in_at" timestamp with time zone,
  "status" text DEFAULT 'pending'::text,
  "approval_status" text DEFAULT 'pending'::text,
  "approved_at" timestamp with time zone,
  "approved_by" text,
  "family_read_at" timestamp with time zone,
  "tenant_id" text,
  "clock_in_lat" double precision,
  "clock_in_lng" double precision,
  "clock_in_accuracy" double precision,
  "geo_verified" boolean DEFAULT false,
  "geo_distance_m" integer,
  "geo_override_reason" text,
  "tag_scan_id" text,
  "tag_scan_method" text,
  "tag_scanned_at" timestamp with time zone,
  "tag_verified" boolean DEFAULT false,
  CONSTRAINT "visits_pkey" PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS "voice_memos" (
  "id" text NOT NULL,
  "visit_id" text,
  "carer_id" text,
  "client_id" text,
  "audio_url" text,
  "duration" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "tenant_id" text,
  CONSTRAINT "voice_memos_pkey" PRIMARY KEY (id)
);


CREATE INDEX idx_agencies_tenant ON public.agencies USING btree (tenant_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX idx_audit_logs_carer ON public.audit_logs USING btree (carer_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);
CREATE INDEX idx_audit_logs_visit ON public.audit_logs USING btree (visit_id);
CREATE INDEX idx_body_map_marks_tenant ON public.body_map_marks USING btree (tenant_id);
CREATE INDEX idx_body_map_marks_tenant_visit ON public.body_map_marks USING btree (tenant_id, visit_id);
CREATE INDEX idx_body_map_marks_visit ON public.body_map_marks USING btree (visit_id);
CREATE INDEX idx_care_plans_client ON public.care_plans USING btree (client_id);
CREATE INDEX idx_care_plans_status ON public.care_plans USING btree (status);
CREATE INDEX idx_care_plans_tenant ON public.care_plans USING btree (tenant_id);
CREATE INDEX idx_caregiver_assignments_caregiver ON public.caregiver_client_assignments USING btree (caregiver_id);
CREATE INDEX idx_caregiver_assignments_client ON public.caregiver_client_assignments USING btree (client_id);
CREATE INDEX idx_caregiver_assignments_tenant_caregiver ON public.caregiver_client_assignments USING btree (tenant_id, caregiver_id);
CREATE INDEX idx_caregiver_client_assignments_tenant ON public.caregiver_client_assignments USING btree (tenant_id);
CREATE INDEX idx_avail_carer ON public.carer_availability USING btree (carer_id);
CREATE INDEX idx_avail_tenant ON public.carer_availability USING btree (tenant_id);
CREATE INDEX idx_clients_tenant ON public.clients USING btree (tenant_id);
CREATE INDEX idx_conv_p1 ON public.conversations USING btree (participant1_id);
CREATE INDEX idx_conv_p2 ON public.conversations USING btree (participant2_id);
CREATE INDEX idx_conv_tenant ON public.conversations USING btree (tenant_id);
CREATE INDEX idx_dbs_carer ON public.dbs_checks USING btree (carer_id);
CREATE INDEX idx_dbs_expiry ON public.dbs_checks USING btree (expiry_date);
CREATE INDEX idx_dbs_status ON public.dbs_checks USING btree (status);
CREATE INDEX idx_dbs_tenant ON public.dbs_checks USING btree (tenant_id);
CREATE INDEX idx_wipe_device ON public.device_wipe_commands USING btree (device_id);
CREATE INDEX idx_wipe_status ON public.device_wipe_commands USING btree (status);
CREATE INDEX idx_wipe_tenant ON public.device_wipe_commands USING btree (tenant_id);
CREATE INDEX idx_drug_interactions_tenant ON public.drug_interactions USING btree (tenant_id);
CREATE INDEX idx_family_members_client ON public.family_members USING btree (client_id);
CREATE INDEX idx_family_members_email ON public.family_members USING btree (email);
CREATE INDEX idx_family_members_tenant ON public.family_members USING btree (tenant_id);
CREATE INDEX idx_family_messages_tenant ON public.family_messages USING btree (tenant_id);
CREATE INDEX idx_family_messages_tenant_client ON public.family_messages USING btree (tenant_id, client_id);
CREATE INDEX idx_family_messages_visit ON public.family_messages USING btree (visit_id);
CREATE INDEX idx_incidents_client ON public.incidents USING btree (client_id);
CREATE INDEX idx_incidents_tenant ON public.incidents USING btree (tenant_id);
CREATE INDEX idx_incidents_tenant_resolved ON public.incidents USING btree (tenant_id, resolved);
CREATE INDEX idx_incidents_visit ON public.incidents USING btree (visit_id);
CREATE INDEX idx_leave_carer ON public.leave_requests USING btree (carer_id);
CREATE INDEX idx_leave_dates ON public.leave_requests USING btree (start_date, end_date);
CREATE INDEX idx_leave_status ON public.leave_requests USING btree (status);
CREATE INDEX idx_leave_tenant ON public.leave_requests USING btree (tenant_id);
CREATE INDEX idx_medication_logs_client ON public.medication_logs USING btree (client_id);
CREATE INDEX idx_medication_logs_tenant ON public.medication_logs USING btree (tenant_id);
CREATE INDEX idx_medication_logs_tenant_client ON public.medication_logs USING btree (tenant_id, client_id);
CREATE INDEX idx_medication_logs_visit ON public.medication_logs USING btree (visit_id);
CREATE INDEX idx_msg_conv ON public.messages USING btree (conversation_id);
CREATE INDEX idx_msg_created ON public.messages USING btree (created_at);
CREATE INDEX idx_msg_sender ON public.messages USING btree (sender_id);
CREATE INDEX idx_msg_tenant ON public.messages USING btree (tenant_id);
CREATE INDEX idx_rtw_carer ON public.right_to_work_checks USING btree (carer_id);
CREATE INDEX idx_rtw_status ON public.right_to_work_checks USING btree (verification_status);
CREATE INDEX idx_rtw_tenant ON public.right_to_work_checks USING btree (tenant_id);
CREATE INDEX idx_scheduled_visits_carer ON public.scheduled_visits USING btree (carer_id);
CREATE INDEX idx_scheduled_visits_date ON public.scheduled_visits USING btree (visit_date);
CREATE INDEX idx_scheduled_visits_tenant ON public.scheduled_visits USING btree (tenant_id);
CREATE INDEX idx_scheduled_visits_tenant_carer_date ON public.scheduled_visits USING btree (tenant_id, carer_id, visit_date);
CREATE INDEX idx_sos_alerts_tenant ON public.sos_alerts USING btree (tenant_id);
CREATE INDEX idx_sos_alerts_tenant_resolved ON public.sos_alerts USING btree (tenant_id, resolved);
CREATE INDEX idx_sos_alerts_timestamp ON public.sos_alerts USING btree ("timestamp");
CREATE INDEX idx_sos_alerts_visit ON public.sos_alerts USING btree (visit_id);
CREATE INDEX idx_sup_carer ON public.supervisions USING btree (carer_id);
CREATE INDEX idx_sup_date ON public.supervisions USING btree (scheduled_date);
CREATE INDEX idx_sup_status ON public.supervisions USING btree (status);
CREATE INDEX idx_sup_tenant ON public.supervisions USING btree (tenant_id);
CREATE INDEX idx_task_logs_client ON public.task_logs USING btree (client_id);
CREATE INDEX idx_task_logs_tenant ON public.task_logs USING btree (tenant_id);
CREATE INDEX idx_task_logs_tenant_client ON public.task_logs USING btree (tenant_id, client_id);
CREATE INDEX idx_tasks_tenant ON public.tasks USING btree (tenant_id);
CREATE INDEX idx_tenant_users_tenant ON public.tenant_users USING btree (tenant_id);
CREATE INDEX idx_tenant_users_user ON public.tenant_users USING btree (user_id);
CREATE INDEX idx_train_carer ON public.training_certifications USING btree (carer_id);
CREATE INDEX idx_train_category ON public.training_certifications USING btree (category);
CREATE INDEX idx_train_expiry ON public.training_certifications USING btree (expiry_date);
CREATE INDEX idx_train_status ON public.training_certifications USING btree (status);
CREATE INDEX idx_train_tenant ON public.training_certifications USING btree (tenant_id);
CREATE INDEX idx_travel_carer ON public.travel_logs USING btree (carer_id);
CREATE INDEX idx_travel_date ON public.travel_logs USING btree (visit_date);
CREATE INDEX idx_travel_tenant ON public.travel_logs USING btree (tenant_id);
CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id);
CREATE INDEX idx_visit_drafts_tenant ON public.visit_drafts USING btree (tenant_id);
CREATE INDEX idx_visits_client_id ON public.visits USING btree (client_id);
CREATE INDEX idx_visits_status ON public.visits USING btree (status);
CREATE INDEX idx_visits_tenant ON public.visits USING btree (tenant_id);
CREATE INDEX idx_visits_tenant_status ON public.visits USING btree (tenant_id, status);
CREATE INDEX idx_visits_tenant_submitted ON public.visits USING btree (tenant_id, submitted_at DESC);
CREATE INDEX idx_voice_memos_tenant ON public.voice_memos USING btree (tenant_id);
CREATE INDEX idx_voice_memos_visit ON public.voice_memos USING btree (visit_id);
