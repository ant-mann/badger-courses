import { NextResponse } from 'next/server';

import { searchCourses } from '@/lib/course-data';

const MAX_LIMIT = 50;

function parseLimit(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const subject = searchParams.get('subject')?.trim() ?? '';

  if (!q && !subject) {
    return NextResponse.json(
      { error: 'At least one of q or subject is required.' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    courses: await searchCourses({
      query: q,
      subject,
      limit: parseLimit(searchParams.get('limit')),
    }),
  });
}
