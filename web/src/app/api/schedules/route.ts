import { NextResponse } from 'next/server';

import { generateSchedules } from '@madgrades/schedule';
import { type PreferenceRuleId } from '@/app/schedule-builder/preferences';
import { generateSchedulesFromPostgres } from '@/lib/course-data';

import {
  clampScheduleLimit,
  normalizeUniqueCourseDesignations,
} from '@/lib/course-designation';
import { getCourseSqliteDb } from '@/lib/db';
import { useSupabaseRuntime } from '@/lib/env';
import { normalizePreferenceOrderInput, normalizeBooleanInput } from './normalize';

type ScheduleRequestBody = {
  courses?: unknown;
  lock_packages?: unknown;
  exclude_packages?: unknown;
  limit?: unknown;
  preference_order?: unknown;
  include_waitlisted?: unknown;
  include_closed?: unknown;
};

type GenerateSchedulesOptions = {
  courses: string[];
  lockPackages: string[];
  excludePackages: string[];
  limit: number;
  preferenceOrder: PreferenceRuleId[];
  includeWaitlisted: boolean;
  includeClosed: boolean;
};

const generateSchedulesTyped = generateSchedules as unknown as (
  db: Awaited<ReturnType<typeof getCourseSqliteDb>>,
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

  try {
    return normalizeUniqueCourseDesignations(value);
  } catch {
    return null;
  }
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
    return clampScheduleLimit(undefined);
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return clampScheduleLimit(value);
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
  const preferenceOrder = normalizePreferenceOrderInput(body.preference_order);
  const includeWaitlisted = normalizeBooleanInput(body.include_waitlisted);
  const includeClosed = normalizeBooleanInput(body.include_closed);

  if (!courses) {
    return NextResponse.json(
      { error: 'courses must be a non-empty array of up to 8 course strings.' },
      { status: 400 },
    );
  }

  if (
    !lockPackages ||
    !excludePackages ||
    limit === null ||
    !preferenceOrder ||
    includeWaitlisted === null ||
    includeClosed === null
  ) {
    return NextResponse.json({ error: 'Invalid schedule request body.' }, { status: 400 });
  }

  const schedules = useSupabaseRuntime()
    ? await generateSchedulesFromPostgres({
        courses,
        lockPackages,
        excludePackages,
        limit,
        preferenceOrder,
        includeWaitlisted,
        includeClosed,
      })
    : (() => {
        const db = getCourseSqliteDb();

        return db.then((resolvedDb) =>
          generateSchedulesTyped(resolvedDb, {
            courses,
            lockPackages,
            excludePackages,
            limit,
            preferenceOrder,
            includeWaitlisted,
            includeClosed,
          }),
        );
      })();

  return NextResponse.json(
    {
      schedules: await schedules,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    },
  );
}
