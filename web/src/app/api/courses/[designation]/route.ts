import { NextResponse } from 'next/server';

import { getCourseDetail } from '@/lib/course-data';

type RouteContext = {
  params: Promise<{
    designation: string;
  }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { designation } = await params;
  const detail = getCourseDetail(designation);

  if (!detail) {
    return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
  }

  return NextResponse.json({
    course: detail.course,
    sections: detail.sections,
    meetings: detail.meetings,
    prerequisites: detail.prerequisites,
    instructor_grades: detail.instructorGrades,
    schedule_packages: detail.schedulePackages,
    package_section_memberships: detail.packageSectionMemberships,
  });
}
