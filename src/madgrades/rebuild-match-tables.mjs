import Database from 'better-sqlite3';

import { buildMadgradesMatchReport, buildMadgradesMatchResults } from './import-runner.mjs';

function loadPersistedMadgradesCourses(db) {
  const courseRows = db.prepare(`
    SELECT
      madgrades_course_id,
      subject_code,
      catalog_number,
      course_designation,
      name
    FROM madgrades_courses
    ORDER BY madgrades_course_id
  `).all();
  const subjectAliasesByCourseId = db.prepare(`
    SELECT madgrades_course_id, subject_alias
    FROM madgrades_course_subject_aliases
    ORDER BY madgrades_course_id, subject_alias
  `).all().reduce((aliases, row) => {
    const existing = aliases.get(row.madgrades_course_id) ?? [];
    existing.push(row.subject_alias);
    aliases.set(row.madgrades_course_id, existing);
    return aliases;
  }, new Map());
  const namesByCourseId = db.prepare(`
    SELECT madgrades_course_id, course_name
    FROM madgrades_course_names
    ORDER BY madgrades_course_id, course_name
  `).all().reduce((names, row) => {
    const existing = names.get(row.madgrades_course_id) ?? [];
    existing.push(row.course_name);
    names.set(row.madgrades_course_id, existing);
    return names;
  }, new Map());

  return courseRows.map((row) => ({
    uuid: row.madgrades_course_id,
    subject: row.subject_code,
    subjectAliases: subjectAliasesByCourseId.get(row.madgrades_course_id) ?? [row.subject_code],
    number: row.catalog_number,
    name: row.name ?? row.course_designation,
    names: namesByCourseId.get(row.madgrades_course_id) ?? (row.name ? [row.name] : [row.course_designation]),
  }));
}

function loadPersistedMadgradesInstructors(db) {
  return db.prepare(`
    SELECT
      madgrades_instructor_id,
      display_name
    FROM madgrades_instructors
    ORDER BY madgrades_instructor_id
  `).all().map((row) => ({
    id: row.madgrades_instructor_id,
    name: row.display_name,
  }));
}

function replaceMadgradesMatchTables(db, matchReport) {
  const insertCourseMatch = db.prepare(`
    INSERT INTO madgrades_course_matches (
      term_code,
      course_id,
      madgrades_course_id,
      match_status,
      matched_at
    ) VALUES (
      @term_code,
      @course_id,
      @madgrades_course_id,
      @match_status,
      @matched_at
    )
  `);
  const insertInstructorMatch = db.prepare(`
    INSERT INTO madgrades_instructor_matches (
      instructor_key,
      madgrades_instructor_id,
      match_status,
      matched_at
    ) VALUES (
      @instructor_key,
      @madgrades_instructor_id,
      @match_status,
      @matched_at
    )
  `);

  db.transaction(() => {
    db.prepare('DELETE FROM madgrades_course_matches').run();
    db.prepare('DELETE FROM madgrades_instructor_matches').run();

    for (const row of matchReport.courseMatches) {
      insertCourseMatch.run(row);
    }

    for (const row of matchReport.instructorMatches) {
      insertInstructorMatch.run(row);
    }
  })();

  return {
    courseMatches: matchReport.courseMatches.length,
    instructorMatches: matchReport.instructorMatches.length,
  };
}

export async function rebuildMadgradesMatches({
  courseDbPath,
  madgradesDbPath,
  now = new Date(),
} = {}) {
  const courseDb = new Database(courseDbPath, { readonly: true });
  const madgradesDb = new Database(madgradesDbPath);

  try {
    const madgradesCourses = loadPersistedMadgradesCourses(madgradesDb);
    const madgradesInstructors = loadPersistedMadgradesInstructors(madgradesDb);
    const { courseMatches, instructorMatches } = buildMadgradesMatchResults({
      db: courseDb,
      madgradesCourses,
      madgradesInstructors,
    });
    const matchReport = buildMadgradesMatchReport({
      courseMatches,
      instructorMatches,
      matchedAt: now,
    });
    const counts = replaceMadgradesMatchTables(madgradesDb, matchReport);

    return {
      madgradesDbPath,
      ...counts,
    };
  } finally {
    madgradesDb.close();
    courseDb.close();
  }
}
