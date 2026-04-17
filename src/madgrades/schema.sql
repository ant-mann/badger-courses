PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS madgrades_instructor_matches;
DROP TABLE IF EXISTS madgrades_course_matches;
DROP TABLE IF EXISTS madgrades_course_names;
DROP TABLE IF EXISTS madgrades_course_subject_aliases;
DROP TABLE IF EXISTS madgrades_instructor_grade_distributions;
DROP TABLE IF EXISTS madgrades_instructor_grades;
DROP TABLE IF EXISTS madgrades_course_grade_distributions;
DROP TABLE IF EXISTS madgrades_course_offerings;
DROP TABLE IF EXISTS madgrades_course_grades;
DROP TABLE IF EXISTS madgrades_instructors;
DROP TABLE IF EXISTS madgrades_courses;
DROP TABLE IF EXISTS madgrades_refresh_runs;

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
  name TEXT,
  UNIQUE (subject_code, catalog_number)
);

CREATE TABLE madgrades_course_subject_aliases (
  madgrades_course_id INTEGER NOT NULL,
  subject_alias TEXT NOT NULL,
  PRIMARY KEY (madgrades_course_id, subject_alias),
  FOREIGN KEY (madgrades_course_id)
    REFERENCES madgrades_courses (madgrades_course_id)
    ON DELETE CASCADE
);

CREATE TABLE madgrades_course_names (
  madgrades_course_id INTEGER NOT NULL,
  course_name TEXT NOT NULL,
  PRIMARY KEY (madgrades_course_id, course_name),
  FOREIGN KEY (madgrades_course_id)
    REFERENCES madgrades_courses (madgrades_course_id)
    ON DELETE CASCADE
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

CREATE TABLE madgrades_course_matches (
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  madgrades_course_id INTEGER,
  match_status TEXT NOT NULL,
  matched_at TEXT,
  PRIMARY KEY (term_code, course_id),
  FOREIGN KEY (madgrades_course_id)
    REFERENCES madgrades_courses (madgrades_course_id)
    ON DELETE SET NULL
);

CREATE TABLE madgrades_instructor_matches (
  instructor_key TEXT PRIMARY KEY,
  madgrades_instructor_id INTEGER,
  match_status TEXT NOT NULL,
  matched_at TEXT,
  FOREIGN KEY (madgrades_instructor_id)
    REFERENCES madgrades_instructors (madgrades_instructor_id)
    ON DELETE SET NULL
);

CREATE INDEX idx_madgrades_courses_designation ON madgrades_courses(course_designation);
CREATE INDEX idx_madgrades_course_subject_aliases_course
  ON madgrades_course_subject_aliases(madgrades_course_id, subject_alias);
CREATE INDEX idx_madgrades_course_names_course
  ON madgrades_course_names(madgrades_course_id, course_name);
CREATE INDEX idx_madgrades_course_grades_course_term ON madgrades_course_grades(madgrades_course_id, term_code);
CREATE INDEX idx_madgrades_course_offerings_course_instructor_term
  ON madgrades_course_offerings(madgrades_course_id, madgrades_instructor_id, term_code);
CREATE INDEX idx_madgrades_instructor_grades_instructor_term
  ON madgrades_instructor_grades(madgrades_instructor_id, term_code);
CREATE INDEX idx_madgrades_course_matches_course ON madgrades_course_matches(madgrades_course_id, match_status);
CREATE INDEX idx_madgrades_instructor_matches_instructor
  ON madgrades_instructor_matches(madgrades_instructor_id, match_status);
