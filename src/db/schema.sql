PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

DROP VIEW IF EXISTS online_courses_v;
DROP VIEW IF EXISTS current_term_section_instructor_grade_overview_v;
DROP VIEW IF EXISTS instructor_course_history_overview_v;
DROP VIEW IF EXISTS instructor_grade_overview_v;
DROP VIEW IF EXISTS course_grade_overview_v;
DROP VIEW IF EXISTS prerequisite_course_summary_overview_v;
DROP VIEW IF EXISTS prerequisite_rule_overview_v;
DROP VIEW IF EXISTS schedule_candidates_v;
DROP VIEW IF EXISTS schedule_planning_v;
DROP VIEW IF EXISTS availability_v;
DROP VIEW IF EXISTS section_overview_v;
DROP VIEW IF EXISTS course_cross_listing_overview_v;
DROP VIEW IF EXISTS course_overview_v;

DROP TABLE IF EXISTS refresh_runs;
DROP TABLE IF EXISTS madgrades_instructor_matches;
DROP TABLE IF EXISTS madgrades_course_matches;
DROP TABLE IF EXISTS madgrades_instructor_grade_distributions;
DROP TABLE IF EXISTS madgrades_instructor_grades;
DROP TABLE IF EXISTS madgrades_instructors;
DROP TABLE IF EXISTS madgrades_course_grade_distributions;
DROP TABLE IF EXISTS madgrades_course_offerings;
DROP TABLE IF EXISTS madgrades_course_grades;
DROP TABLE IF EXISTS madgrades_courses;
DROP TABLE IF EXISTS madgrades_refresh_runs;
DROP TABLE IF EXISTS prerequisite_course_summaries;
DROP TABLE IF EXISTS prerequisite_edges;
DROP TABLE IF EXISTS prerequisite_nodes;
DROP TABLE IF EXISTS prerequisite_rules;
DROP TABLE IF EXISTS package_transitions;
DROP TABLE IF EXISTS schedule_conflicts;
DROP TABLE IF EXISTS schedulable_packages;
DROP TABLE IF EXISTS canonical_meetings;
DROP TABLE IF EXISTS canonical_sections;
DROP TABLE IF EXISTS section_instructors;
DROP TABLE IF EXISTS instructors;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS course_cross_listings;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS buildings;

CREATE TABLE refresh_runs (
  refresh_id INTEGER PRIMARY KEY,
  snapshot_run_at TEXT NOT NULL,
  last_refreshed_at TEXT NOT NULL,
  source_term_code TEXT NOT NULL,
  snapshot_kind TEXT NOT NULL
);

CREATE TABLE madgrades_refresh_runs (
  madgrades_refresh_run_id INTEGER PRIMARY KEY,
  snapshot_run_at TEXT NOT NULL,
  last_refreshed_at TEXT NOT NULL,
  source_term_code TEXT,
  notes TEXT
);

CREATE TABLE madgrades_courses (
  madgrades_course_id INTEGER PRIMARY KEY,
  subject_code TEXT NOT NULL,
  catalog_number TEXT NOT NULL,
  course_designation TEXT NOT NULL,
  UNIQUE (subject_code, catalog_number)
);

CREATE TABLE madgrades_instructors (
  madgrades_instructor_id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL
);

CREATE TABLE madgrades_course_grades (
  madgrades_course_grade_id INTEGER PRIMARY KEY,
  madgrades_refresh_run_id INTEGER NOT NULL,
  madgrades_course_id INTEGER NOT NULL,
  term_code TEXT NOT NULL,
  student_count INTEGER NOT NULL,
  avg_gpa REAL NOT NULL,
  CHECK (student_count >= 0),
  CHECK (avg_gpa >= 0),
  FOREIGN KEY (madgrades_refresh_run_id)
    REFERENCES madgrades_refresh_runs (madgrades_refresh_run_id)
    ON DELETE CASCADE,
  FOREIGN KEY (madgrades_course_id)
    REFERENCES madgrades_courses (madgrades_course_id)
    ON DELETE CASCADE,
  UNIQUE (madgrades_refresh_run_id, madgrades_course_id, term_code)
);

CREATE TABLE madgrades_course_offerings (
  madgrades_course_offering_id INTEGER PRIMARY KEY,
  madgrades_course_id INTEGER NOT NULL,
  madgrades_instructor_id INTEGER NOT NULL,
  term_code TEXT NOT NULL,
  section_type TEXT,
  student_count INTEGER NOT NULL,
  avg_gpa REAL NOT NULL,
  CHECK (student_count >= 0),
  CHECK (avg_gpa >= 0),
  FOREIGN KEY (madgrades_course_id)
    REFERENCES madgrades_courses (madgrades_course_id)
    ON DELETE CASCADE,
  FOREIGN KEY (madgrades_instructor_id)
    REFERENCES madgrades_instructors (madgrades_instructor_id)
    ON DELETE CASCADE,
  UNIQUE (madgrades_course_id, madgrades_instructor_id, term_code, section_type)
);

CREATE TABLE madgrades_course_grade_distributions (
  madgrades_course_grade_distribution_id INTEGER PRIMARY KEY,
  madgrades_course_grade_id INTEGER NOT NULL,
  grade_code TEXT NOT NULL,
  student_count INTEGER NOT NULL,
  CHECK (student_count >= 0),
  FOREIGN KEY (madgrades_course_grade_id)
    REFERENCES madgrades_course_grades (madgrades_course_grade_id)
    ON DELETE CASCADE,
  UNIQUE (madgrades_course_grade_id, grade_code)
);

CREATE TABLE madgrades_instructor_grades (
  madgrades_instructor_grade_id INTEGER PRIMARY KEY,
  madgrades_refresh_run_id INTEGER NOT NULL,
  madgrades_instructor_id INTEGER NOT NULL,
  term_code TEXT NOT NULL,
  student_count INTEGER NOT NULL,
  avg_gpa REAL NOT NULL,
  CHECK (student_count >= 0),
  CHECK (avg_gpa >= 0),
  FOREIGN KEY (madgrades_refresh_run_id)
    REFERENCES madgrades_refresh_runs (madgrades_refresh_run_id)
    ON DELETE CASCADE,
  FOREIGN KEY (madgrades_instructor_id)
    REFERENCES madgrades_instructors (madgrades_instructor_id)
    ON DELETE CASCADE,
  UNIQUE (madgrades_refresh_run_id, madgrades_instructor_id, term_code)
);

CREATE TABLE madgrades_instructor_grade_distributions (
  madgrades_instructor_grade_distribution_id INTEGER PRIMARY KEY,
  madgrades_instructor_grade_id INTEGER NOT NULL,
  grade_code TEXT NOT NULL,
  student_count INTEGER NOT NULL,
  CHECK (student_count >= 0),
  FOREIGN KEY (madgrades_instructor_grade_id)
    REFERENCES madgrades_instructor_grades (madgrades_instructor_grade_id)
    ON DELETE CASCADE,
  UNIQUE (madgrades_instructor_grade_id, grade_code)
);

CREATE TABLE madgrades_course_matches (
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  madgrades_course_id INTEGER,
  match_status TEXT NOT NULL,
  matched_at TEXT,
  PRIMARY KEY (term_code, course_id),
  FOREIGN KEY (term_code, course_id)
    REFERENCES courses (term_code, course_id)
    ON DELETE CASCADE,
  FOREIGN KEY (madgrades_course_id)
    REFERENCES madgrades_courses (madgrades_course_id)
    ON DELETE SET NULL
);

CREATE TABLE madgrades_instructor_matches (
  instructor_key TEXT PRIMARY KEY,
  madgrades_instructor_id INTEGER,
  match_status TEXT NOT NULL,
  matched_at TEXT,
  FOREIGN KEY (instructor_key)
    REFERENCES instructors (instructor_key)
    ON DELETE CASCADE,
  FOREIGN KEY (madgrades_instructor_id)
    REFERENCES madgrades_instructors (madgrades_instructor_id)
    ON DELETE SET NULL
);

CREATE TABLE courses (
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  subject_code TEXT,
  subject_short_description TEXT,
  subject_description TEXT,
  catalog_number TEXT,
  course_designation TEXT,
  title TEXT,
  description TEXT,
  minimum_credits REAL,
  maximum_credits REAL,
  enrollment_prerequisites TEXT,
  currently_taught INTEGER,
  last_taught TEXT,
  PRIMARY KEY (term_code, course_id)
);

CREATE TABLE course_cross_listings (
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_designation TEXT NOT NULL,
  full_course_designation TEXT,
  subject_code TEXT,
  catalog_number TEXT,
  is_primary INTEGER NOT NULL,
  CHECK (is_primary IN (0, 1)),
  PRIMARY KEY (term_code, course_id, course_designation),
  FOREIGN KEY (term_code, course_id)
    REFERENCES courses (term_code, course_id)
    ON DELETE CASCADE
);

CREATE TABLE prerequisite_rules (
  rule_id TEXT PRIMARY KEY,
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  parse_status TEXT NOT NULL,
  parse_confidence REAL NOT NULL,
  root_node_id TEXT,
  unparsed_text TEXT,
  FOREIGN KEY (term_code, course_id)
    REFERENCES courses (term_code, course_id)
    ON DELETE CASCADE,
  FOREIGN KEY (rule_id, root_node_id)
    REFERENCES prerequisite_nodes (rule_id, node_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_prerequisite_rules_rule_course
  ON prerequisite_rules(rule_id, term_code, course_id);

CREATE TABLE prerequisite_nodes (
  node_id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  value TEXT,
  normalized_value TEXT,
  position_start INTEGER,
  position_end INTEGER,
  UNIQUE (rule_id, node_id),
  FOREIGN KEY (rule_id)
    REFERENCES prerequisite_rules (rule_id)
    ON DELETE CASCADE
);

CREATE TABLE prerequisite_edges (
  rule_id TEXT NOT NULL,
  parent_node_id TEXT NOT NULL,
  child_node_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (rule_id, parent_node_id, child_node_id),
  FOREIGN KEY (rule_id, parent_node_id)
    REFERENCES prerequisite_nodes (rule_id, node_id)
    ON DELETE CASCADE,
  FOREIGN KEY (rule_id, child_node_id)
    REFERENCES prerequisite_nodes (rule_id, node_id)
    ON DELETE CASCADE
);

CREATE TABLE prerequisite_course_summaries (
  rule_id TEXT PRIMARY KEY,
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  summary_status TEXT NOT NULL,
  course_groups_json TEXT NOT NULL,
  escape_clauses_json TEXT NOT NULL,
  CHECK (json_valid(course_groups_json)),
  CHECK (json_valid(escape_clauses_json)),
  FOREIGN KEY (term_code, course_id)
    REFERENCES courses (term_code, course_id)
    ON DELETE CASCADE,
  FOREIGN KEY (rule_id, term_code, course_id)
    REFERENCES prerequisite_rules (rule_id, term_code, course_id)
    ON DELETE CASCADE
);

CREATE TABLE packages (
  package_id TEXT PRIMARY KEY,
  term_code TEXT NOT NULL,
  subject_code TEXT,
  course_id TEXT NOT NULL,
  package_last_updated INTEGER,
  enrollment_class_number INTEGER,
  package_status TEXT,
  package_available_seats INTEGER,
  package_waitlist_total INTEGER,
  online_only INTEGER,
  is_asynchronous INTEGER,
  open_seats INTEGER,
  waitlist_current_size INTEGER,
  capacity INTEGER,
  currently_enrolled INTEGER,
  has_open_seats INTEGER,
  has_waitlist INTEGER,
  is_full INTEGER,
  FOREIGN KEY (term_code, course_id)
    REFERENCES courses (term_code, course_id)
    ON DELETE CASCADE
);

CREATE TABLE sections (
  package_id TEXT NOT NULL,
  -- Real upstream class number when available; otherwise a stable synthetic
  -- negative identifier scoped to the course so section joins remain coherent.
  section_class_number INTEGER NOT NULL,
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  section_number TEXT,
  section_type TEXT,
  instruction_mode TEXT,
  session_code TEXT,
  published INTEGER,
  open_seats INTEGER,
  waitlist_current_size INTEGER,
  capacity INTEGER,
  currently_enrolled INTEGER,
  has_open_seats INTEGER,
  has_waitlist INTEGER,
  is_full INTEGER,
  PRIMARY KEY (package_id, section_class_number),
  FOREIGN KEY (package_id)
    REFERENCES packages (package_id)
    ON DELETE CASCADE,
  FOREIGN KEY (term_code, course_id)
    REFERENCES courses (term_code, course_id)
    ON DELETE CASCADE
);

CREATE TABLE meetings (
  package_id TEXT NOT NULL,
  section_class_number INTEGER NOT NULL,
  meeting_index INTEGER NOT NULL,
  meeting_type TEXT,
  meeting_time_start INTEGER,
  meeting_time_end INTEGER,
  meeting_days TEXT,
  start_date INTEGER,
  end_date INTEGER,
  exam_date INTEGER,
  room TEXT,
  building_code TEXT,
  is_exam INTEGER,
  location_known INTEGER,
  PRIMARY KEY (package_id, section_class_number, meeting_index),
  FOREIGN KEY (package_id, section_class_number)
    REFERENCES sections (package_id, section_class_number)
    ON DELETE CASCADE,
  FOREIGN KEY (building_code)
    REFERENCES buildings (building_code)
);

CREATE TABLE buildings (
  building_code TEXT PRIMARY KEY,
  building_name TEXT,
  street_address TEXT,
  latitude REAL,
  longitude REAL
);

CREATE TABLE instructors (
  instructor_key TEXT PRIMARY KEY,
  netid TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT
);

CREATE TABLE section_instructors (
  package_id TEXT NOT NULL,
  section_class_number INTEGER NOT NULL,
  instructor_key TEXT NOT NULL,
  PRIMARY KEY (package_id, section_class_number, instructor_key),
  FOREIGN KEY (package_id, section_class_number)
    REFERENCES sections (package_id, section_class_number)
    ON DELETE CASCADE,
  FOREIGN KEY (instructor_key)
    REFERENCES instructors (instructor_key)
    ON DELETE CASCADE
);

CREATE TABLE canonical_sections (
  term_code TEXT NOT NULL,
  subject_code TEXT,
  catalog_number TEXT,
  course_id TEXT NOT NULL,
  course_designation TEXT,
  title TEXT,
  minimum_credits REAL,
  maximum_credits REAL,
  section_class_number INTEGER NOT NULL,
  source_package_id TEXT NOT NULL,
  source_package_last_updated INTEGER,
  section_number TEXT,
  section_type TEXT,
  instruction_mode TEXT,
  session_code TEXT,
  open_seats INTEGER,
  waitlist_current_size INTEGER,
  capacity INTEGER,
  currently_enrolled INTEGER,
  has_open_seats INTEGER,
  has_waitlist INTEGER,
  is_full INTEGER,
  PRIMARY KEY (term_code, course_id, section_class_number),
  FOREIGN KEY (source_package_id)
    REFERENCES packages (package_id)
    ON DELETE CASCADE
);

CREATE TABLE canonical_meetings (
  package_id TEXT NOT NULL,
  source_package_id TEXT NOT NULL,
  section_class_number INTEGER NOT NULL,
  meeting_index INTEGER NOT NULL,
  meeting_type TEXT,
  meeting_time_start INTEGER,
  meeting_time_end INTEGER,
  meeting_days TEXT,
  start_date INTEGER,
  end_date INTEGER,
  exam_date INTEGER,
  room TEXT,
  building_code TEXT,
  building_name TEXT,
  street_address TEXT,
  latitude REAL,
  longitude REAL,
  timezone_name TEXT NOT NULL,
  days_mask INTEGER,
  start_minute_local INTEGER,
  end_minute_local INTEGER,
  duration_minutes INTEGER,
  is_online INTEGER NOT NULL,
  location_known INTEGER,
  PRIMARY KEY (package_id, section_class_number, meeting_index),
  FOREIGN KEY (package_id)
    REFERENCES packages (package_id)
    ON DELETE CASCADE,
  FOREIGN KEY (source_package_id)
    REFERENCES packages (package_id)
    ON DELETE CASCADE
);

CREATE TABLE schedulable_packages (
  source_package_id TEXT PRIMARY KEY,
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_designation TEXT,
  title TEXT,
  section_bundle_label TEXT NOT NULL,
  open_seats INTEGER,
  is_full INTEGER,
  has_waitlist INTEGER,
  meeting_count INTEGER NOT NULL,
  campus_day_count INTEGER NOT NULL,
  earliest_start_minute_local INTEGER,
  latest_end_minute_local INTEGER,
  has_online_meeting INTEGER NOT NULL,
  has_unknown_location INTEGER NOT NULL,
  restriction_note TEXT,
  has_temporary_restriction INTEGER NOT NULL,
  meeting_summary_local TEXT
);

CREATE INDEX idx_courses_subject ON courses(subject_code, catalog_number);
CREATE INDEX idx_course_cross_listings_course ON course_cross_listings(term_code, course_id);
CREATE INDEX idx_course_cross_listings_designation ON course_cross_listings(term_code, course_designation);
CREATE UNIQUE INDEX idx_course_cross_listings_one_primary_per_course
  ON course_cross_listings(term_code, course_id)
  WHERE is_primary = 1;
CREATE INDEX idx_prerequisite_rules_course ON prerequisite_rules(term_code, course_id);
CREATE INDEX idx_prerequisite_nodes_rule ON prerequisite_nodes(rule_id);
CREATE INDEX idx_prerequisite_edges_child ON prerequisite_edges(rule_id, child_node_id);
CREATE INDEX idx_prerequisite_course_summaries_course ON prerequisite_course_summaries(term_code, course_id);
CREATE INDEX idx_madgrades_courses_designation ON madgrades_courses(course_designation);
CREATE INDEX idx_madgrades_course_grades_course_term ON madgrades_course_grades(madgrades_course_id, term_code);
CREATE INDEX idx_madgrades_course_offerings_course_instructor_term
  ON madgrades_course_offerings(madgrades_course_id, madgrades_instructor_id, term_code);
CREATE INDEX idx_madgrades_instructor_grades_instructor_term
  ON madgrades_instructor_grades(madgrades_instructor_id, term_code);
CREATE INDEX idx_madgrades_course_matches_course ON madgrades_course_matches(madgrades_course_id, match_status);
CREATE INDEX idx_madgrades_instructor_matches_instructor
  ON madgrades_instructor_matches(madgrades_instructor_id, match_status);
CREATE INDEX idx_packages_course ON packages(term_code, course_id);
CREATE INDEX idx_packages_updated ON packages(package_last_updated DESC, package_id);
CREATE INDEX idx_sections_course ON sections(term_code, course_id, section_type);
CREATE INDEX idx_meetings_building ON meetings(building_code);
CREATE INDEX idx_canonical_sections_designation ON canonical_sections(course_designation, section_type, section_number);
CREATE INDEX idx_canonical_sections_course_package ON canonical_sections(term_code, course_id, source_package_id);
CREATE INDEX idx_canonical_meetings_package_time ON canonical_meetings(package_id, days_mask, start_minute_local, end_minute_local);
CREATE INDEX idx_schedulable_packages_designation_open ON schedulable_packages(course_designation, has_temporary_restriction, open_seats);
CREATE INDEX idx_schedulable_packages_designation_day_start ON schedulable_packages(course_designation, campus_day_count, earliest_start_minute_local);

CREATE VIRTUAL TABLE course_search_fts USING fts5(
  term_code UNINDEXED,
  course_id UNINDEXED,
  canonical_course_designation UNINDEXED,
  alias_course_designation,
  alias_course_designation_normalized UNINDEXED,
  alias_course_designation_compact,
  title,
  title_normalized UNINDEXED,
  description,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3 4'
);

CREATE VIEW course_cross_listing_overview_v AS
SELECT
  ccl.term_code,
  ccl.course_id,
  c.course_designation AS canonical_course_designation,
  ccl.course_designation AS alias_course_designation,
  ccl.full_course_designation,
  ccl.subject_code,
  ccl.catalog_number,
  c.title,
  ccl.is_primary
FROM course_cross_listings ccl
JOIN courses c
  ON c.term_code = ccl.term_code AND c.course_id = ccl.course_id;

CREATE VIEW course_overview_v AS
WITH cross_list_agg AS (
  SELECT
    term_code,
    course_id,
    json_group_array(course_designation) AS cross_list_designations_json,
    COUNT(*) AS cross_list_count
  FROM (
    SELECT term_code, course_id, course_designation
    FROM course_cross_listings
    ORDER BY course_designation
  ) ordered_cross_listings
  GROUP BY term_code, course_id
)
SELECT
  c.term_code,
  c.subject_code,
  c.catalog_number,
  c.course_id,
  c.course_designation,
  c.title,
  c.minimum_credits,
  c.maximum_credits,
  COALESCE(cla.cross_list_designations_json, json_array(c.course_designation)) AS cross_list_designations_json,
  COALESCE(cla.cross_list_count, 1) AS cross_list_count,
  COUNT(DISTINCT so.section_class_number) AS section_count,
  MAX(so.has_open_seats) AS has_any_open_seats,
  MAX(so.has_waitlist) AS has_any_waitlist,
  MAX(so.is_full) AS has_any_full_section
FROM courses c
LEFT JOIN section_overview_v so
  ON so.term_code = c.term_code AND so.course_id = c.course_id
LEFT JOIN cross_list_agg cla
  ON cla.term_code = c.term_code AND cla.course_id = c.course_id
GROUP BY
  c.term_code, c.subject_code, c.catalog_number, c.course_id,
  c.course_designation, c.title, c.minimum_credits, c.maximum_credits,
  cla.cross_list_designations_json, cla.cross_list_count;

CREATE VIEW prerequisite_rule_overview_v AS
SELECT
  pr.term_code,
  c.subject_code,
  c.catalog_number,
  pr.course_id,
  c.course_designation,
  c.title,
  pr.rule_id,
  pr.parse_status,
  pr.parse_confidence,
  pr.raw_text,
  pr.unparsed_text
FROM prerequisite_rules pr
JOIN courses c
  ON c.term_code = pr.term_code AND c.course_id = pr.course_id;

CREATE VIEW prerequisite_course_summary_overview_v AS
SELECT
  pcs.term_code,
  c.subject_code,
  c.catalog_number,
  pcs.course_id,
  c.course_designation,
  c.title,
  pcs.rule_id,
  pr.parse_status,
  pr.parse_confidence,
  pcs.summary_status,
  pcs.course_groups_json,
  pcs.escape_clauses_json,
  pr.raw_text,
  pr.unparsed_text
FROM prerequisite_course_summaries pcs
JOIN courses c
  ON c.term_code = pcs.term_code AND c.course_id = pcs.course_id
JOIN prerequisite_rules pr
  ON pr.rule_id = pcs.rule_id
 AND pr.term_code = pcs.term_code
 AND pr.course_id = pcs.course_id;

CREATE VIEW course_grade_overview_v AS
WITH latest_course_grades AS (
  SELECT
    mcg.*,
    ROW_NUMBER() OVER (
      PARTITION BY mcg.madgrades_course_id, mcg.term_code
      ORDER BY mcg.madgrades_refresh_run_id DESC, mcg.madgrades_course_grade_id DESC
    ) AS refresh_rank
  FROM madgrades_course_grades mcg
)
SELECT
  mc.madgrades_course_id,
  mc.subject_code,
  mc.catalog_number,
  mc.course_designation,
  COUNT(lcg.madgrades_course_grade_id) AS course_grade_term_count,
  COALESCE(SUM(lcg.student_count), 0) AS historical_student_count,
  CASE
    WHEN COALESCE(SUM(lcg.student_count), 0) = 0 THEN NULL
    ELSE SUM(lcg.avg_gpa * lcg.student_count) / SUM(lcg.student_count)
  END AS historical_gpa
FROM madgrades_courses mc
LEFT JOIN latest_course_grades lcg
  ON lcg.madgrades_course_id = mc.madgrades_course_id
 AND lcg.refresh_rank = 1
GROUP BY
  mc.madgrades_course_id,
  mc.subject_code,
  mc.catalog_number,
  mc.course_designation;

CREATE VIEW instructor_grade_overview_v AS
WITH latest_instructor_grades AS (
  SELECT
    mig.*,
    ROW_NUMBER() OVER (
      PARTITION BY mig.madgrades_instructor_id, mig.term_code
      ORDER BY mig.madgrades_refresh_run_id DESC, mig.madgrades_instructor_grade_id DESC
    ) AS refresh_rank
  FROM madgrades_instructor_grades mig
)
SELECT
  mi.madgrades_instructor_id,
  mi.display_name,
  COUNT(lig.madgrades_instructor_grade_id) AS instructor_grade_term_count,
  COALESCE(SUM(lig.student_count), 0) AS historical_student_count,
  CASE
    WHEN COALESCE(SUM(lig.student_count), 0) = 0 THEN NULL
    ELSE SUM(lig.avg_gpa * lig.student_count) / SUM(lig.student_count)
  END AS overall_gpa
FROM madgrades_instructors mi
LEFT JOIN latest_instructor_grades lig
  ON lig.madgrades_instructor_id = mi.madgrades_instructor_id
 AND lig.refresh_rank = 1
GROUP BY
  mi.madgrades_instructor_id,
  mi.display_name;

CREATE VIEW instructor_course_history_overview_v AS
SELECT
  mco.madgrades_course_id,
  mco.madgrades_instructor_id,
  mc.course_designation,
  mi.display_name AS instructor_display_name,
  COUNT(*) AS prior_offering_count,
  COALESCE(SUM(mco.student_count), 0) AS student_count,
  CASE
    WHEN COALESCE(SUM(mco.student_count), 0) = 0 THEN NULL
    ELSE SUM(mco.avg_gpa * mco.student_count) / SUM(mco.student_count)
  END AS same_course_gpa
FROM madgrades_course_offerings mco
JOIN madgrades_courses mc
  ON mc.madgrades_course_id = mco.madgrades_course_id
JOIN madgrades_instructors mi
  ON mi.madgrades_instructor_id = mco.madgrades_instructor_id
GROUP BY
  mco.madgrades_course_id,
  mco.madgrades_instructor_id,
  mc.course_designation,
  mi.display_name;

CREATE VIEW section_overview_v AS
WITH ranked_section_sources AS (
  SELECT
    s.term_code,
    s.course_id,
    s.section_class_number,
    s.package_id AS source_package_id,
    p.package_last_updated AS source_package_last_updated,
    s.section_number,
    s.section_type,
    s.instruction_mode,
    s.session_code,
    s.open_seats,
    s.waitlist_current_size,
    s.capacity,
    s.currently_enrolled,
    ROW_NUMBER() OVER (
      PARTITION BY s.term_code, s.course_id, s.section_class_number
      ORDER BY COALESCE(p.package_last_updated, -1) DESC, s.package_id DESC
    ) AS source_rank
  FROM sections s
  JOIN packages p
    ON p.package_id = s.package_id
)
SELECT
  rs.term_code,
  c.subject_code,
  c.catalog_number,
  rs.course_id,
  c.course_designation,
  c.title,
  rs.section_class_number,
  rs.source_package_id,
  rs.source_package_last_updated,
  rs.section_number,
  rs.section_type,
  rs.instruction_mode,
  rs.session_code,
  rs.open_seats,
  rs.waitlist_current_size,
  rs.capacity,
  rs.currently_enrolled,
  CASE
    WHEN rs.open_seats IS NULL THEN NULL
    WHEN rs.open_seats > 0 THEN 1
    ELSE 0
  END AS has_open_seats,
  CASE
    WHEN rs.waitlist_current_size IS NULL THEN NULL
    WHEN rs.waitlist_current_size > 0 THEN 1
    ELSE 0
  END AS has_waitlist,
  CASE
    WHEN rs.open_seats IS NULL THEN NULL
    WHEN rs.open_seats <= 0 THEN 1
    ELSE 0
  END AS is_full
FROM ranked_section_sources rs
JOIN courses c
  ON c.term_code = rs.term_code AND c.course_id = rs.course_id
WHERE rs.source_rank = 1;

CREATE VIEW availability_v AS
SELECT
  p.term_code,
  c.subject_code,
  c.catalog_number,
  c.course_designation,
  c.title,
  p.package_id,
  p.package_status,
  p.package_available_seats,
  p.package_waitlist_total,
  p.open_seats,
  p.waitlist_current_size,
  p.has_open_seats,
  p.has_waitlist,
  p.is_full,
  p.online_only,
  p.is_asynchronous
FROM packages p
JOIN courses c
  ON c.term_code = p.term_code AND c.course_id = p.course_id;

CREATE VIEW schedule_planning_v AS
SELECT
  so.term_code,
  so.subject_code,
  so.catalog_number,
  so.course_id,
  so.course_designation,
  so.title,
  so.section_class_number,
  so.source_package_id,
  so.source_package_last_updated,
  so.section_number,
  so.section_type,
  so.instruction_mode,
  m.meeting_index,
  m.meeting_type,
  m.meeting_days,
  m.meeting_time_start,
  m.meeting_time_end,
  m.start_date,
  m.end_date,
  m.exam_date,
  m.room,
  m.building_code,
  b.building_name,
  b.street_address,
  b.latitude,
  b.longitude,
  m.location_known,
  so.has_open_seats,
  so.is_full
FROM section_overview_v so
JOIN meetings m
  ON m.package_id = so.source_package_id
 AND m.section_class_number = so.section_class_number
LEFT JOIN buildings b
  ON b.building_code = m.building_code;

CREATE VIEW online_courses_v AS
WITH freshest_course_packages AS (
  SELECT
    term_code,
    course_id,
    MAX(COALESCE(package_last_updated, -1)) AS freshest_package_last_updated
  FROM packages
  GROUP BY term_code, course_id
)
SELECT DISTINCT
  c.term_code,
  c.subject_code,
  c.catalog_number,
  c.course_id,
  c.course_designation,
  c.title,
  c.minimum_credits,
  c.maximum_credits
FROM courses c
JOIN freshest_course_packages fcp
  ON fcp.term_code = c.term_code
 AND fcp.course_id = c.course_id
JOIN packages p
  ON p.term_code = c.term_code
 AND p.course_id = c.course_id
 AND COALESCE(p.package_last_updated, -1) = fcp.freshest_package_last_updated
WHERE COALESCE(p.online_only, 0) = 1
   OR COALESCE(p.is_asynchronous, 0) = 1;

CREATE VIEW current_term_section_instructor_grade_overview_v AS
WITH current_term AS (
  SELECT MAX(source_term_code) AS term_code
  FROM refresh_runs
),
current_sections AS (
  SELECT so.*
  FROM section_overview_v so
  JOIN current_term ct
    ON ct.term_code = so.term_code
),
current_section_instructors AS (
  SELECT
    cs.term_code,
    cs.course_id,
    cs.course_designation,
    cs.section_class_number,
    cs.section_number,
    cs.section_type,
    si.instructor_key,
    TRIM(COALESCE(i.first_name || ' ', '') || COALESCE(i.last_name, '')) AS instructor_display_name,
    mim.match_status AS instructor_match_status,
    mcm.madgrades_course_id,
    mim.madgrades_instructor_id
  FROM current_sections cs
  JOIN section_instructors si
    ON si.package_id = cs.source_package_id
   AND si.section_class_number = cs.section_class_number
  JOIN instructors i
    ON i.instructor_key = si.instructor_key
  LEFT JOIN madgrades_course_matches mcm
    ON mcm.term_code = cs.term_code
   AND mcm.course_id = cs.course_id
  LEFT JOIN madgrades_instructor_matches mim
    ON mim.instructor_key = si.instructor_key
)
SELECT
  csi.term_code,
  csi.course_id,
  csi.section_class_number,
  csi.section_number,
  csi.section_type,
  csi.instructor_key,
  csi.course_designation,
  CASE
    WHEN csi.instructor_display_name = '' THEN NULL
    ELSE csi.instructor_display_name
  END AS instructor_display_name,
  ich.prior_offering_count AS same_course_prior_offering_count,
  ich.student_count AS same_course_student_count,
  ich.same_course_gpa,
  cgo.historical_gpa AS course_historical_gpa,
  csi.instructor_match_status
FROM current_section_instructors csi
LEFT JOIN instructor_course_history_overview_v ich
  ON ich.madgrades_course_id = csi.madgrades_course_id
  AND ich.madgrades_instructor_id = csi.madgrades_instructor_id
LEFT JOIN course_grade_overview_v cgo
  ON cgo.madgrades_course_id = csi.madgrades_course_id;

CREATE VIEW schedule_candidates_v AS
SELECT *
FROM schedulable_packages;
