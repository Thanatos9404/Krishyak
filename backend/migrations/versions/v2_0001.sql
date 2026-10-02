CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE v2_auth_challenges (
	mobile VARCHAR(16) NOT NULL, 
	provider VARCHAR(20) NOT NULL, 
	provider_reference VARCHAR(100), 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	attempts INTEGER NOT NULL, 
	consumed BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
)

;

CREATE TABLE v2_farmers (
	mobile VARCHAR(16) NOT NULL, 
	display_name VARCHAR(100) NOT NULL, 
	preferred_language VARCHAR(10) NOT NULL, 
	state VARCHAR(100), 
	district VARCHAR(100), 
	village VARCHAR(100), 
	timezone VARCHAR(50) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	role VARCHAR(30) NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (mobile)
)

;

CREATE TABLE v2_object_deletions (
	object_key VARCHAR(300) NOT NULL, 
	attempts INTEGER NOT NULL, 
	available_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (object_key)
)

;

CREATE TABLE v2_audit_log (
	actor_id UUID, 
	action VARCHAR(100) NOT NULL, 
	target_id UUID, 
	details JSONB NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(actor_id) REFERENCES v2_farmers (id) ON DELETE SET NULL
)

;

CREATE TABLE v2_consents (
	farmer_id UUID NOT NULL, 
	purpose VARCHAR(50) NOT NULL, 
	categories JSONB NOT NULL, 
	policy_version VARCHAR(30) NOT NULL, 
	consent_version VARCHAR(30) NOT NULL, 
	collection_surface VARCHAR(50) NOT NULL, 
	granted_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	withdrawn_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(farmer_id) REFERENCES v2_farmers (id) ON DELETE CASCADE
)

;

CREATE TABLE v2_farms (
	farmer_id UUID NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	location VARCHAR(200), 
	ownership VARCHAR(30), 
	operation_id UUID NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (farmer_id, operation_id), 
	FOREIGN KEY(farmer_id) REFERENCES v2_farmers (id) ON DELETE CASCADE
)

;

CREATE TABLE v2_pilot_cohorts (
	name VARCHAR(100) NOT NULL, 
	organisation_admin_id UUID NOT NULL, 
	district VARCHAR(100) NOT NULL, 
	crops JSONB NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organisation_admin_id) REFERENCES v2_farmers (id) ON DELETE CASCADE
)

;

CREATE TABLE v2_sessions (
	farmer_id UUID NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	refresh_hash VARCHAR(64) NOT NULL, 
	csrf_hash VARCHAR(64) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	refresh_expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	revoked BOOLEAN NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(farmer_id) REFERENCES v2_farmers (id) ON DELETE CASCADE, 
	UNIQUE (token_hash), 
	UNIQUE (refresh_hash)
)

;

CREATE TABLE v2_pilot_enrollments (
	cohort_id UUID NOT NULL, 
	farmer_id UUID NOT NULL, 
	consent_id UUID NOT NULL, 
	withdrawn_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (cohort_id, farmer_id), 
	FOREIGN KEY(cohort_id) REFERENCES v2_pilot_cohorts (id) ON DELETE CASCADE, 
	FOREIGN KEY(farmer_id) REFERENCES v2_farmers (id) ON DELETE CASCADE, 
	FOREIGN KEY(consent_id) REFERENCES v2_consents (id) ON DELETE CASCADE
)

;

CREATE TABLE v2_plots (
	farm_id UUID NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	boundary geometry(POLYGON,4326), 
	centroid geometry(POINT,4326), 
	area_hectares NUMERIC(14, 6), 
	entered_area_hectares NUMERIC(14, 6), 
	boundary_quality VARCHAR(20) NOT NULL, 
	irrigation_type VARCHAR(50), 
	soil_metadata JSONB NOT NULL, 
	revision INTEGER NOT NULL, 
	operation_id UUID NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (farm_id, operation_id), 
	FOREIGN KEY(farm_id) REFERENCES v2_farms (id) ON DELETE CASCADE
)

;

CREATE TABLE v2_crop_cycles (
	plot_id UUID NOT NULL, 
	crop VARCHAR(100) NOT NULL, 
	variety VARCHAR(100), 
	sowing_date DATE NOT NULL, 
	expected_harvest DATE NOT NULL, 
	growth_stage VARCHAR(50), 
	season VARCHAR(50), 
	status VARCHAR(20) NOT NULL, 
	identity_source VARCHAR(30) NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(plot_id) REFERENCES v2_plots (id) ON DELETE CASCADE
)

;

CREATE TABLE v2_images (
	farmer_id UUID NOT NULL, 
	plot_id UUID, 
	object_key VARCHAR(300) NOT NULL, 
	sha256 VARCHAR(64) NOT NULL, 
	mime VARCHAR(50) NOT NULL, 
	width INTEGER NOT NULL, 
	height INTEGER NOT NULL, 
	research_consent_id UUID, 
	result JSONB NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(farmer_id) REFERENCES v2_farmers (id) ON DELETE CASCADE, 
	FOREIGN KEY(plot_id) REFERENCES v2_plots (id) ON DELETE CASCADE, 
	UNIQUE (object_key), 
	FOREIGN KEY(research_consent_id) REFERENCES v2_consents (id) ON DELETE SET NULL
)

;

CREATE TABLE v2_jobs (
	plot_id UUID NOT NULL, 
	operation_id UUID NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	payload JSONB NOT NULL, 
	attempts INTEGER NOT NULL, 
	available_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	leased_until TIMESTAMP WITH TIME ZONE, 
	error_code VARCHAR(100), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (plot_id, operation_id), 
	FOREIGN KEY(plot_id) REFERENCES v2_plots (id) ON DELETE CASCADE
)

;

CREATE TABLE v2_observations (
	plot_id UUID NOT NULL, 
	kind VARCHAR(40) NOT NULL, 
	observed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	source_type VARCHAR(40) NOT NULL, 
	source VARCHAR(100) NOT NULL, 
	payload JSONB NOT NULL, 
	provenance JSONB NOT NULL, 
	operation_id UUID NOT NULL, 
	payload_hash VARCHAR(64) NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (plot_id, operation_id), 
	FOREIGN KEY(plot_id) REFERENCES v2_plots (id) ON DELETE CASCADE
)

;

CREATE TABLE v2_feedback (
	farmer_id UUID NOT NULL, 
	image_id UUID NOT NULL, 
	verdict VARCHAR(20) NOT NULL, 
	note TEXT, 
	corrected_class VARCHAR(150), 
	reviewer_id UUID, 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(farmer_id) REFERENCES v2_farmers (id) ON DELETE CASCADE, 
	FOREIGN KEY(image_id) REFERENCES v2_images (id) ON DELETE CASCADE, 
	FOREIGN KEY(reviewer_id) REFERENCES v2_farmers (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_v2_auth_challenges_mobile ON v2_auth_challenges (mobile);
CREATE INDEX ix_v2_object_deletions_status ON v2_object_deletions (status);
CREATE INDEX ix_v2_consents_farmer_id ON v2_consents (farmer_id);
CREATE INDEX ix_v2_farms_farmer_id ON v2_farms (farmer_id);
CREATE INDEX ix_v2_pilot_cohorts_organisation_admin_id ON v2_pilot_cohorts (organisation_admin_id);
CREATE INDEX ix_v2_sessions_farmer_id ON v2_sessions (farmer_id);
CREATE INDEX ix_v2_pilot_enrollments_cohort_id ON v2_pilot_enrollments (cohort_id);
CREATE INDEX ix_v2_pilot_enrollments_farmer_id ON v2_pilot_enrollments (farmer_id);
CREATE INDEX ix_v2_plots_farm_id ON v2_plots (farm_id);
CREATE INDEX idx_v2_plots_centroid ON v2_plots USING gist (centroid);
CREATE INDEX idx_v2_plots_boundary ON v2_plots USING gist (boundary);
CREATE INDEX ix_v2_crop_cycles_plot_id ON v2_crop_cycles (plot_id);
CREATE INDEX ix_v2_images_plot_id ON v2_images (plot_id);
CREATE INDEX ix_v2_images_farmer_id ON v2_images (farmer_id);
CREATE INDEX ix_v2_jobs_plot_id ON v2_jobs (plot_id);
CREATE INDEX ix_v2_jobs_status ON v2_jobs (status);
CREATE INDEX ix_v2_observation_timeline ON v2_observations (plot_id, observed_at, kind);
CREATE INDEX ix_v2_feedback_image_id ON v2_feedback (image_id);
CREATE INDEX ix_v2_feedback_farmer_id ON v2_feedback (farmer_id);
ALTER TABLE v2_plots ADD CONSTRAINT valid_boundary CHECK (boundary IS NULL OR (ST_IsValid(boundary) AND ST_NumInteriorRings(boundary)=0 AND ST_NPoints(boundary)<=201 AND ST_Area(boundary::geography) BETWEEN 100 AND 5000000));
ALTER TABLE v2_plots ADD CONSTRAINT correct_area CHECK (boundary IS NULL OR abs(area_hectares - ST_Area(boundary::geography)/10000) < 0.000001);
ALTER TABLE v2_crop_cycles ADD CONSTRAINT cycle_dates CHECK (expected_harvest > sowing_date AND expected_harvest - sowing_date <= 1095);
ALTER TABLE v2_crop_cycles ADD CONSTRAINT no_overlapping_cycles EXCLUDE USING gist (plot_id WITH =, daterange(sowing_date,expected_harvest,'[]') WITH &&) WHERE (status IN ('active','planned'));
CREATE UNIQUE INDEX ix_v2_active_consent ON v2_consents (farmer_id,purpose) WHERE withdrawn_at IS NULL;
