-- ==============================================
-- ENHANCED DATABASE SCHEMA FOR AVAILABILITY MANAGEMENT
-- ==============================================
-- Combines user's superior architecture with recommended additions
-- for performance, versioning, and gym operator support

-- ==============================================
-- CORE TABLES
-- ==============================================

-- Operators table with support for concurrent appointments (gym instructors)
CREATE TABLE operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    surname VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    color VARCHAR(7), -- For UI display
    operator_type VARCHAR(20) DEFAULT 'standard' CHECK (operator_type IN ('standard', 'gym', 'resource')),
    max_concurrent_appointments INTEGER DEFAULT 1, -- For gym operators
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Services table
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    duration INTEGER NOT NULL, -- in minutes
    buffer_time INTEGER DEFAULT 0, -- cleanup time between appointments
    color VARCHAR(7),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Operator-Service associations with specific settings
CREATE TABLE operator_services (
    operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    custom_duration INTEGER, -- Override default service duration
    custom_buffer_time INTEGER, -- Override default buffer time
    PRIMARY KEY (operator_id, service_id)
);

-- ==============================================
-- AVAILABILITY TEMPLATES (User's Superior Pattern Design)
-- ==============================================

-- Template definitions with versioning support
CREATE TABLE availability_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
    name VARCHAR(255), -- e.g., "Summer Schedule", "Winter Hours"
    description TEXT,

    -- Pattern configuration (User's flexible approach)
    day_in_pattern INTEGER NOT NULL, -- Day within the pattern (0-based)
    pattern_duration INTEGER NOT NULL, -- Total days in pattern (7 for weekly, 14 for bi-weekly, etc.)
    pattern_start_date DATE NOT NULL, -- When this pattern starts

    -- Time slots
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Versioning (recommended addition)
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    valid_from DATE NOT NULL,
    valid_until DATE,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_pattern CHECK (day_in_pattern >= 0 AND day_in_pattern < pattern_duration),
    CONSTRAINT valid_times CHECK (end_time > start_time)
);

-- Index for efficient template queries
CREATE INDEX idx_availability_templates_operator ON availability_templates(operator_id, is_current);
CREATE INDEX idx_availability_templates_date_range ON availability_templates(valid_from, valid_until);

-- ==============================================
-- EXCEPTIONS AND OVERRIDES
-- ==============================================

-- Availability exceptions (holidays, sick days, special schedules)
CREATE TABLE availability_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    exception_type VARCHAR(50) NOT NULL, -- 'unavailable', 'modified', 'holiday', 'sick', 'vacation'

    -- For modified availability (NULL if completely unavailable)
    start_time TIME,
    end_time TIME,

    -- Optional reference to group exceptions (e.g., company holidays)
    group_exception_id UUID,

    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(operator_id, exception_date)
);

-- Group exceptions (company-wide holidays, closures)
CREATE TABLE group_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL, -- e.g., "Christmas Holiday", "Company Training Day"
    exception_date DATE NOT NULL,
    exception_type VARCHAR(50) NOT NULL,
    applies_to_all BOOLEAN DEFAULT false,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Which operators are affected by group exceptions
CREATE TABLE group_exception_operators (
    group_exception_id UUID REFERENCES group_exceptions(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
    PRIMARY KEY (group_exception_id, operator_id)
);

-- ==============================================
-- APPOINTMENTS
-- ==============================================

-- Appointments table with support for concurrent bookings
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    client_phone VARCHAR(50),

    -- Temporal data
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Status management
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),

    -- For gym classes with multiple participants
    participant_count INTEGER DEFAULT 1,
    max_participants INTEGER, -- NULL for standard appointments

    -- Notes and metadata
    notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, -- Reference to user who created the appointment

    CONSTRAINT valid_appointment_times CHECK (end_time > start_time)
);

-- Efficient appointment queries
CREATE INDEX idx_appointments_operator_date ON appointments(operator_id, appointment_date);
CREATE INDEX idx_appointments_date_time ON appointments(appointment_date, start_time);
CREATE INDEX idx_appointments_status ON appointments(status) WHERE status != 'cancelled';

-- ==============================================
-- PERFORMANCE OPTIMIZATION: CACHE TABLE (Recommended Addition)
-- ==============================================

-- Materialized availability cache for fast queries
CREATE TABLE availability_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
    available_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Capacity tracking for gym operators
    total_capacity INTEGER DEFAULT 1,
    booked_capacity INTEGER DEFAULT 0,

    -- Source tracking
    source VARCHAR(50), -- 'template', 'exception', 'override'
    source_id UUID, -- Reference to template or exception

    -- Cache management
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(operator_id, available_date, start_time)
);

-- Optimized cache queries
CREATE INDEX idx_availability_cache_lookup ON availability_cache(operator_id, available_date);
CREATE INDEX idx_availability_cache_date_range ON availability_cache(available_date, start_time);

-- ==============================================
-- AUDIT AND HISTORY (Recommended Addition)
-- ==============================================

-- Template change history for audit trail
CREATE TABLE template_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID,
    operator_id UUID,
    action VARCHAR(50), -- 'created', 'updated', 'deleted'
    previous_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT
);

-- ==============================================
-- HELPER FUNCTIONS
-- ==============================================

-- Function to calculate which day in pattern for a given date
CREATE OR REPLACE FUNCTION get_pattern_day(
    p_date DATE,
    p_start_date DATE,
    p_pattern_duration INTEGER
) RETURNS INTEGER AS $$
BEGIN
    RETURN (p_date - p_start_date) % p_pattern_duration;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to rebuild availability cache for an operator
CREATE OR REPLACE FUNCTION rebuild_availability_cache(
    p_operator_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS VOID AS $$
DECLARE
    v_current_date DATE;
    v_template RECORD;
    v_exception RECORD;
    v_pattern_day INTEGER;
BEGIN
    -- Clear existing cache for date range
    DELETE FROM availability_cache
    WHERE operator_id = p_operator_id
    AND available_date BETWEEN p_start_date AND p_end_date;

    -- Loop through each date
    v_current_date := p_start_date;
    WHILE v_current_date <= p_end_date LOOP
        -- Check for exceptions first
        SELECT * INTO v_exception
        FROM availability_exceptions
        WHERE operator_id = p_operator_id
        AND exception_date = v_current_date;

        IF FOUND THEN
            -- Handle exception
            IF v_exception.exception_type = 'modified' AND v_exception.start_time IS NOT NULL THEN
                INSERT INTO availability_cache (
                    operator_id, available_date, start_time, end_time,
                    total_capacity, source, source_id
                )
                SELECT
                    p_operator_id, v_current_date, v_exception.start_time, v_exception.end_time,
                    COALESCE(o.max_concurrent_appointments, 1), 'exception', v_exception.id
                FROM operators o
                WHERE o.id = p_operator_id;
            END IF;
        ELSE
            -- Apply template
            FOR v_template IN
                SELECT t.*, o.max_concurrent_appointments
                FROM availability_templates t
                JOIN operators o ON o.id = t.operator_id
                WHERE t.operator_id = p_operator_id
                AND t.is_current = true
                AND v_current_date >= t.valid_from
                AND (t.valid_until IS NULL OR v_current_date <= t.valid_until)
            LOOP
                v_pattern_day := get_pattern_day(v_current_date, v_template.pattern_start_date, v_template.pattern_duration);

                IF v_pattern_day = v_template.day_in_pattern THEN
                    INSERT INTO availability_cache (
                        operator_id, available_date, start_time, end_time,
                        total_capacity, source, source_id
                    ) VALUES (
                        p_operator_id, v_current_date, v_template.start_time, v_template.end_time,
                        COALESCE(v_template.max_concurrent_appointments, 1), 'template', v_template.id
                    );
                END IF;
            END LOOP;
        END IF;

        v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;

    -- Update booked capacity from appointments
    UPDATE availability_cache ac
    SET booked_capacity = (
        SELECT COUNT(*)
        FROM appointments a
        WHERE a.operator_id = ac.operator_id
        AND a.appointment_date = ac.available_date
        AND a.start_time < ac.end_time
        AND a.end_time > ac.start_time
        AND a.status NOT IN ('cancelled', 'no_show')
    )
    WHERE ac.operator_id = p_operator_id
    AND ac.available_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_operators_updated_at BEFORE UPDATE ON operators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- SAMPLE DATA FOR TESTING
-- ==============================================

-- Sample operators (including gym instructor)
INSERT INTO operators (name, surname, email, operator_type, max_concurrent_appointments, color) VALUES
    ('Mario', 'Rossi', 'mario.rossi@example.com', 'standard', 1, '#FF6B6B'),
    ('Laura', 'Bianchi', 'laura.bianchi@example.com', 'standard', 1, '#4ECDC4'),
    ('Giovanni', 'Verdi', 'giovanni.verdi@example.com', 'gym', 10, '#45B7D1'); -- Gym instructor

-- Sample services
INSERT INTO services (name, duration, buffer_time, color) VALUES
    ('Taglio Capelli', 30, 5, '#FF6B6B'),
    ('Colorazione', 90, 10, '#4ECDC4'),
    ('Pilates Group Class', 60, 15, '#45B7D1');

-- ==============================================
-- USEFUL QUERIES
-- ==============================================

-- Get available slots for an operator on a specific date
-- (Accounting for templates, exceptions, and existing appointments)
/*
WITH available_slots AS (
    SELECT
        ac.operator_id,
        ac.available_date,
        ac.start_time,
        ac.end_time,
        ac.total_capacity - ac.booked_capacity as available_capacity
    FROM availability_cache ac
    WHERE ac.operator_id = $1
    AND ac.available_date = $2
    AND ac.total_capacity > ac.booked_capacity
)
SELECT * FROM available_slots
ORDER BY start_time;
*/

-- Check if a specific time slot is available
/*
SELECT
    CASE
        WHEN ac.total_capacity > ac.booked_capacity THEN true
        ELSE false
    END as is_available
FROM availability_cache ac
WHERE ac.operator_id = $1
AND ac.available_date = $2
AND $3 >= ac.start_time  -- requested start time
AND $4 <= ac.end_time;    -- requested end time
*/