-- Migration 15: Create Family Members and Sessions Tables
-- This migration adds support for the enhanced family access system

-- Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    role VARCHAR(50) NOT NULL CHECK (role IN ('primary', 'secondary', 'limited')),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    relationship VARCHAR(100),
    permissions JSONB NOT NULL DEFAULT '[]',
    pin_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    invited_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false
);

-- Create family_sessions table for authentication
CREATE TABLE IF NOT EXISTS family_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Create family_notifications table
CREATE TABLE IF NOT EXISTS family_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('message', 'visit', 'task', 'emergency', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    related_visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
    related_task_id VARCHAR(255),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create family_messages table for family-to-care-team communication
CREATE TABLE IF NOT EXISTS family_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    sender_name VARCHAR(255) NOT NULL,
    sender_role VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_from_family BOOLEAN DEFAULT true,
    is_urgent BOOLEAN DEFAULT false,
    read_by_care_team BOOLEAN DEFAULT false,
    read_by_family BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create family_invitations table for pending invitations
CREATE TABLE IF NOT EXISTS family_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('primary', 'secondary', 'limited')),
    relationship VARCHAR(100),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_family_members_client_id ON family_members(client_id);
CREATE INDEX IF NOT EXISTS idx_family_members_email ON family_members(email);
CREATE INDEX IF NOT EXISTS idx_family_members_role ON family_members(role);
CREATE INDEX IF NOT EXISTS idx_family_members_is_active ON family_members(is_active);

CREATE INDEX IF NOT EXISTS idx_family_sessions_member_id ON family_sessions(family_member_id);
CREATE INDEX IF NOT EXISTS idx_family_sessions_token_hash ON family_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_family_sessions_expires_at ON family_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_family_sessions_is_active ON family_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_family_notifications_member_id ON family_notifications(family_member_id);
CREATE INDEX IF NOT EXISTS idx_family_notifications_type ON family_notifications(type);
CREATE INDEX IF NOT EXISTS idx_family_notifications_read_at ON family_notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_family_notifications_created_at ON family_notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_family_messages_member_id ON family_messages(family_member_id);
CREATE INDEX IF NOT EXISTS idx_family_messages_client_id ON family_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_family_messages_created_at ON family_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_family_messages_is_from_family ON family_messages(is_from_family);

CREATE INDEX IF NOT EXISTS idx_family_invitations_email ON family_invitations(email);
CREATE INDEX IF NOT EXISTS idx_family_invitations_token ON family_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_family_invitations_client_id ON family_invitations(client_id);

-- Add RLS (Row Level Security) policies for family members
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- Policy: Family members can only see their own records
CREATE POLICY "Family members can view own records" ON family_members
    FOR SELECT USING (id = current_setting('app.current_family_member_id', true)::UUID);

-- Policy: Family members can only update their own records
CREATE POLICY "Family members can update own records" ON family_members
    FOR UPDATE USING (id = current_setting('app.current_family_member_id', true)::UUID);

-- Enable RLS for family_sessions
ALTER TABLE family_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Family members can only manage their own sessions
CREATE POLICY "Family members can manage own sessions" ON family_sessions
    FOR ALL USING (family_member_id = current_setting('app.current_family_member_id', true)::UUID);

-- Enable RLS for family_notifications
ALTER TABLE family_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Family members can only view their own notifications
CREATE POLICY "Family members can view own notifications" ON family_notifications
    FOR SELECT USING (family_member_id = current_setting('app.current_family_member_id', true)::UUID);

-- Enable RLS for family_messages
ALTER TABLE family_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Family members can view messages for their clients
CREATE POLICY "Family members can view client messages" ON family_messages
    FOR SELECT USING (
        family_member_id = current_setting('app.current_family_member_id', true)::UUID OR
        is_from_family = false AND client_id IN (
            SELECT client_id FROM family_members 
            WHERE id = current_setting('app.current_family_member_id', true)::UUID
        )
    );

-- Policy: Family members can create messages for their clients
CREATE POLICY "Family members can create client messages" ON family_messages
    FOR INSERT WITH CHECK (
        family_member_id = current_setting('app.current_family_member_id', true)::UUID
    );

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_family_members_updated_at BEFORE UPDATE ON family_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_messages_updated_at BEFORE UPDATE ON family_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_family_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM family_sessions 
    WHERE expires_at < NOW() OR is_active = false;
END;
$$ LANGUAGE plpgsql;

-- Create function to get family member permissions
CREATE OR REPLACE FUNCTION get_family_member_permissions(member_id UUID)
RETURNS JSONB AS $$
BEGIN
    RETURN COALESCE(
        (SELECT permissions FROM family_members WHERE id = member_id AND is_active = true),
        '[]'::jsonb
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to check if family member has specific permission
CREATE OR REPLACE FUNCTION family_member_has_permission(member_id UUID, permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM family_members 
        WHERE id = member_id 
        AND is_active = true 
        AND permissions @> to_jsonb(permission)
    );
END;
$$ LANGUAGE plpgsql;

-- Create view for family dashboard data
CREATE OR REPLACE VIEW family_dashboard_view AS
SELECT 
    fm.id as family_member_id,
    fm.name as family_member_name,
    fm.email,
    fm.role,
    c.id as client_id,
    c.name as client_name,
    c.age,
    c.condition,
    COUNT(DISTINCT CASE WHEN fn.read_at IS NULL THEN fn.id END) as unread_notifications,
    COUNT(DISTINCT CASE WHEN fm_read.is_from_family = false AND fm_read.read_by_family = false THEN fm_read.id END) as unread_messages,
    (
        SELECT COUNT(*) 
        FROM visits v 
        WHERE v.client_id = c.id 
        AND v.date >= NOW() - INTERVAL '7 days'
        AND v.status = 'completed'
    ) as visits_this_week,
    (
        SELECT MAX(v.date) 
        FROM visits v 
        WHERE v.client_id = c.id 
        AND v.status = 'completed'
    ) as last_visit_date,
    (
        SELECT MIN(v.date) 
        FROM visits v 
        WHERE v.client_id = c.id 
        AND v.date >= NOW() 
        AND v.status = 'scheduled'
    ) as next_visit_date
FROM family_members fm
JOIN clients c ON fm.client_id = c.id
LEFT JOIN family_notifications fn ON fn.family_member_id = fm.id
LEFT JOIN family_messages fm_read ON fm_read.family_member_id = fm.id
WHERE fm.is_active = true
GROUP BY fm.id, fm.name, fm.email, fm.role, c.id, c.name, c.age, c.condition;

-- Add comments for documentation
COMMENT ON TABLE family_members IS 'Stores family member accounts with role-based permissions';
COMMENT ON TABLE family_sessions IS 'Stores authentication sessions for family members';
COMMENT ON TABLE family_notifications IS 'Stores notifications for family members';
COMMENT ON TABLE family_messages IS 'Stores messages between family members and care team';
COMMENT ON TABLE family_invitations IS 'Stores pending family member invitations';

COMMENT ON COLUMN family_members.role IS 'Role: primary (full access), secondary (enhanced access), limited (basic access)';
COMMENT ON COLUMN family_members.permissions IS 'JSON array of specific permissions granted to the family member';
COMMENT ON COLUMN family_members.pin_hash IS 'Hashed 6-digit PIN for authentication';
COMMENT ON COLUMN family_sessions.token_hash IS 'Hashed JWT token for the session';
COMMENT ON COLUMN family_sessions.refresh_token_hash IS 'Hashed refresh token for session renewal';

-- Create default permissions for each role
UPDATE family_members SET permissions = 
    CASE 
        WHEN role = 'primary' THEN 
            '["view_basic_info", "visit_summary", "send_messages", "view_care_tasks", "view_schedule", "receive_notifications", "view_care_plan", "manage_family_members", "approve_changes", "detailed_reports", "emergency_contacts"]'
        WHEN role = 'secondary' THEN 
            '["view_basic_info", "visit_summary", "send_messages", "view_care_tasks", "view_schedule", "receive_notifications", "view_care_plan"]'
        WHEN role = 'limited' THEN 
            '["view_basic_info", "visit_summary", "send_messages"]'
        ELSE '[]'
    END::jsonb
WHERE permissions = '[]'::jsonb;

-- Migration completed successfully
