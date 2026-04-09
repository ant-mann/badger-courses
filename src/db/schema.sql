PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

DROP VIEW IF EXISTS online_courses_v;
DROP VIEW IF EXISTS schedule_planning_v;
DROP VIEW IF EXISTS availability_v;
DROP VIEW IF EXISTS section_overview_v;
DROP VIEW IF EXISTS course_overview_v;

DROP TABLE IF EXISTS refresh_runs;
DROP TABLE IF EXISTS section_instructors;
DROP TABLE IF EXISTS instructors;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS buildings;

CREATE TABLE refresh_runs (
  refresh_id INTEGER PRIMARY KEY,
  snapshot_run_at TEXT NOT NULL,
  last_refreshed_at TEXT NOT NULL,
  source_term_code TEXT NOT NULL,
  snapshot_kind TEXT NOT NULL
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

CREATE INDEX idx_courses_subject ON courses(subject_code, catalog_number);
CREATE INDEX idx_packages_course ON packages(term_code, course_id);
CREATE INDEX idx_packages_updated ON packages(package_last_updated DESC, package_id);
CREATE INDEX idx_sections_course ON sections(term_code, course_id, section_type);
CREATE INDEX idx_meetings_building ON meetings(building_code);

CREATE VIEW course_overview_v AS
SELECT
  c.term_code,
  c.subject_code,
  c.catalog_number,
  c.course_id,
  c.course_designation,
  c.title,
  c.minimum_credits,
  c.maximum_credits,
  COUNT(DISTINCT so.section_class_number) AS section_count,
  MAX(so.has_open_seats) AS has_any_open_seats,
  MAX(so.has_waitlist) AS has_any_waitlist,
  MAX(so.is_full) AS has_any_full_section
FROM courses c
LEFT JOIN section_overview_v so
  ON so.term_code = c.term_code AND so.course_id = c.course_id
GROUP BY
  c.term_code, c.subject_code, c.catalog_number, c.course_id,
  c.course_designation, c.title, c.minimum_credits, c.maximum_credits;

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
