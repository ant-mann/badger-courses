export function buildSearchRequest({ termCode, page, pageSize = 50 }) {
  return {
    selectedTerm: termCode,
    queryString: '*',
    filters: [
      {
        has_child: {
          type: 'enrollmentPackage',
          query: {
            bool: {
              must: [
                { match: { 'packageEnrollmentStatus.status': 'OPEN WAITLISTED CLOSED' } },
                { match: { published: true } },
              ],
            },
          },
        },
      },
    ],
    page,
    pageSize,
    sortOrder: 'SUBJECT',
  };
}

export function extractSearchPage(data) {
  if (!data || data.success !== true) {
    throw new Error('Search response was not successful');
  }

  if (!Array.isArray(data.hits)) {
    throw new Error('Search response must include a hits array');
  }

  if (typeof data.found !== 'number') {
    throw new Error('Search response must include a numeric found count');
  }

  return {
    found: data.found,
    hits: data.hits,
  };
}

export function buildEnrollmentPackagesPath(course) {
  const termCode = course?.termCode;
  const subjectCode = course?.subject?.subjectCode;
  const courseId = course?.courseId;

  if (!termCode || !subjectCode || !courseId) {
    throw new Error('Course record is missing termCode, subject.subjectCode, or courseId');
  }

  return `/api/search/v1/enrollmentPackages/${termCode}/${subjectCode}/${courseId}`;
}

export function normalizeCourseSummary(course) {
  return {
    termCode: course?.termCode ?? null,
    courseId: course?.courseId ?? null,
    subjectCode: course?.subject?.subjectCode ?? null,
    courseDesignation: course?.courseDesignation ?? null,
    title: course?.title ?? null,
  };
}
