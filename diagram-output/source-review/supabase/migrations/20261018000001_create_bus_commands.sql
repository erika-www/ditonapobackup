-- ========================================================
-- 19: BUS COMMANDS & DIRECTION DISPATCH SCHEMA
-- ========================================================

-- Stores direction commands dispatched by Admins or Personnel to Bus Hardware
CREATE TABLE IF NOT EXISTS public.bus_commands (
    id BIGSERIAL PRIMARY KEY,
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
    command_type TEXT NOT NULL DEFAULT 'direction', -- 'direction', 'start_trip', 'end_trip'
    direction TEXT NOT NULL CHECK (direction IN ('Northbound', 'Southbound')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bus_commands_bus_id_id ON public.bus_commands(bus_id, id);

ALTER TABLE public.bus_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read bus_commands" ON public.bus_commands
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert bus_commands" ON public.bus_commands
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update bus_commands" ON public.bus_commands
    FOR UPDATE TO authenticated USING (true);
