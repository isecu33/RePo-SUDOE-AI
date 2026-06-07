-- Initialize PostgreSQL database for RePo-SUDOE-AI
-- This script runs automatically when the PostgreSQL container starts for the first time

-- Optional: Create extensions if needed
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL database initialized successfully for RePo-SUDOE-AI';
END $$;
