import Database from 'better-sqlite3';

import {
  buildMadgradesMatchReport,
  buildMadgradesMatchResults,
  replaceMadgradesMatchTables,
} from './import-runner.mjs';

function requirePersistedCourseMatchingMetadata(db) {
  const courseColumns = db.prepare(`PRAGMA table_info(madgrades_courses)`).all();
  const courseColumnNames = new Set(courseColumns.map((column) => column.name));
  const tableNames = new Set(
    db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('madgrades_course_subject_aliases', 'madgrades_course_names')
    `).pluck().all(),
  );

  if (
    !courseColumnNames.has('name')
    || !tableNames.has('madgrades_course_subject_aliases')
    || !tableNames.has('madgrades_course_names')
  ) {
    throw new Error(
      'Standalone Madgrades DB is missing persisted course matching metadata. Rebuild the database with the current schema before refreshing matches.',
    );
  }
}

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

export async function rebuildMadgradesMatches({
  courseDbPath,
  madgradesDbPath,
  now = new Date(),
} = {}) {
  const courseDb = new Database(courseDbPath, { readonly: true });
  const madgradesDb = new Database(madgradesDbPath);

  try {
    requirePersistedCourseMatchingMetadata(madgradesDb);
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
