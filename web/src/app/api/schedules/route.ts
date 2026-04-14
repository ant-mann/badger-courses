import { NextResponse } from 'next/server';

import { generateSchedules } from '@madgrades/schedule';

import { normalizeDesignation } from '@/lib/course-data';
import { getDb } from '@/lib/db';

const DEFAULT_LIMIT = 25;
const MAX_COURSES = 8;
const MAX_LIMIT = 50;

type ScheduleRequestBody = {
  courses?: unknown;
  lock_packages?: unknown;
  exclude_packages?: unknown;
  limit?: unknown;
};

type GenerateSchedulesOptions = {
  courses: string[];
  lockPackages: string[];
  excludePackages: string[];
  limit: number;
};

const generateSchedulesTyped = generateSchedules as (
  db: ReturnType<typeof getDb>,
  options: GenerateSchedulesOptions,
) => unknown[];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isScheduleRequestBody(value: unknown): value is ScheduleRequestBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeCourses(value: unknown): string[] | null {
  if (!isStringArray(value)) {
    return null;
  }

  let normalized: string[];

  try {
    normalized = value
      .map((course) => normalizeDesignation(course))
      .filter((course, index, allCourses) => allCourses.indexOf(course) === index);
  } catch {
    return null;
  }

  if (normalized.length === 0 || normalized.length > MAX_COURSES) {
    return null;
  }

  return normalized;
}

function normalizePackageIds(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }

  if (!isStringArray(value)) {
    return null;
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function normalizeLimit(value: unknown): number | null {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return Math.min(value, MAX_LIMIT);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isScheduleRequestBody(body)) {
    return NextResponse.json({ error: 'Invalid schedule request body.' }, { status: 400 });
  }

  const courses = normalizeCourses(body.courses);
  const lockPackages = normalizePackageIds(body.lock_packages);
  const excludePackages = normalizePackageIds(body.exclude_packages);
  const limit = normalizeLimit(body.limit);

  if (!courses) {
    return NextResponse.json(
      { error: 'courses must be a non-empty array of up to 8 course strings.' },
      { status: 400 },
    );
  }

  if (!lockPackages || !excludePackages || limit === null) {
    return NextResponse.json({ error: 'Invalid schedule request body.' }, { status: 400 });
  }

  return NextResponse.json(
    {
      schedules: generateSchedulesTyped(getDb(), {
        courses,
        lockPackages,
        excludePackages,
        limit,
      }),
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    },
  );
}
