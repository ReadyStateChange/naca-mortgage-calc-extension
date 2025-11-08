-- Clean schema for Neon PostgreSQL
-- Stripped of all Supabase-specific features (RLS, extensions, roles)

-- Table: naca_mortgage_rates
-- Stores current mortgage rates scraped from NACA website
CREATE TABLE naca_mortgage_rates (
    id BIGSERIAL PRIMARY KEY,
    thirty_year_rate NUMERIC,
    twenty_year_rate NUMERIC,
    fifteen_year_rate NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for efficient latest-rate queries
CREATE INDEX idx_rates_created_at ON naca_mortgage_rates(created_at DESC);

-- Table: ffeic_msa_tract_income_2024
-- Stores MSA (Metropolitan Statistical Area) income data from FFEIC
CREATE TABLE ffeic_msa_tract_income_2024 (
    msa_code INTEGER,
    state_code INTEGER,
    county_code INTEGER,
    tract_code INTEGER,
    tract_median_income_percentage DOUBLE PRECISION,
    msa_median_income INTEGER,
    estimated_tract_median_income INTEGER
);

-- Composite index for MSA lookups (common query pattern)
CREATE INDEX idx_msa_lookup ON ffeic_msa_tract_income_2024(state_code, county_code, tract_code);

