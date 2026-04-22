"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CoursePicker } from "@/app/components/CoursePicker";
import { ScheduleAvailabilityFilters } from "@/app/components/ScheduleAvailabilityFilters";
import { ScheduleCalendar } from "@/app/components/ScheduleCalendar";
import { ScheduleHardFilterBar } from "@/app/components/ScheduleHardFilterBar";
import { SchedulePriorityList } from "@/app/components/SchedulePriorityList";
import { ScheduleResults } from "@/app/components/ScheduleResults";
import { SectionOptionPanel } from "@/app/components/SectionOptionPanel";
import { SelectedCourseList } from "@/app/components/SelectedCourseList";
import {
  addCourse,
  applyPendingBuilderStateUpdate,
  buildCourseDetailsRequestSignature,
  buildScheduleRequestSignature,
  deriveCoursePickerState,
  deriveInteractiveBuilderState,
  derivePendingResultsDisplayState,
  parseBuilderState,
  replacePendingBuilderStateSignature,
  reconcilePendingBuilderStateFromUrl,
  removeCourse,
  serializeBuilderState,
  shouldHideGeneratedSchedulePreview,
  movePreferenceRule,
  setPreferenceRuleEnabled,
  setExcludedSection,
  setLockedSection,
  type ScheduleRequestPayload,
  type ScheduleBuilderState,
} from "@/app/schedule-builder/builder-state";
import {
  deriveScheduleCalendarEntries,
  type GeneratedSchedule,
  type ScheduleBuilderCourseDetailResponse,
  type ScheduleBuilderSchedulesResponse,
} from "@/app/schedule-builder/schedule-data";
import {
  clampScheduleLimit,
} from "@/lib/course-designation";
import type { CourseListItem } from "@/lib/course-data";

export const navigationHooks = {
  useRouter,
  usePathname,
  useSearchParams,
};

type CourseDetailRecord = {
  data: ScheduleBuilderCourseDetailResponse | null;
  loading: boolean;
  errorMessage: string | null;
};

type ScheduleRequestState = "idle" | "loading" | "ready" | "error";

const SEARCH_DEBOUNCE_MS = 200;
const GENERATION_DEBOUNCE_MS = 250;

function buildFallbackCourseDetail(
  designation: string,
  title?: string | null,
): ScheduleBuilderCourseDetailResponse {
  return {
    course: {
      designation,
      title: title ?? designation,
      minimumCredits: 0,
      maximumCredits: 0,
      crossListDesignations: [designation],
      sectionCount: 0,
      hasAnyOpenSeats: false,
      hasAnyWaitlist: false,
      hasAnyFullSection: false,
      description: null,
      subjectCode: "",
      catalogNumber: "",
      courseId: designation,
      enrollmentPrerequisites: null,
    },
    sections: [],
    meetings: [],
    prerequisites: [],
    instructor_grades: [],
    schedule_packages: [],
  };
}

async function readErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };

    if (typeof body.error === "string" && body.error.trim().length > 0) {
      return body.error;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

export function ScheduleBuilder() {
  const router = navigationHooks.useRouter();
  const pathname = navigationHooks.usePathname();
  const searchParams = navigationHooks.useSearchParams();
  const [isRoutingPending, startTransition] = useTransition();
  const builderState = parseBuilderState(new URLSearchParams(searchParams.toString()));
  const courseDetailsRequestSignature = buildCourseDetailsRequestSignature(builderState.courses);
  const scheduleRequestSignature = buildScheduleRequestSignature(builderState);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CourseListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const [courseDetails, setCourseDetails] = useState<Record<string, CourseDetailRecord>>({});
  const [requestState, setRequestState] = useState<ScheduleRequestState>("idle");
  const [schedules, setSchedules] = useState<GeneratedSchedule[]>([]);
  const [emptyStateReason, setEmptyStateReason] = useState<ScheduleBuilderSchedulesResponse["empty_state_reason"]>(null);
  const [generationErrorMessage, setGenerationErrorMessage] = useState<string | null>(null);
  const [selectedScheduleIndex, setSelectedScheduleIndex] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const courseDetailsRef = useRef(courseDetails);
  const pendingBuilderStateRef = useRef(builderState);
  const pendingBuilderStateSignaturesRef = useRef<string[]>([]);
  const lastReconciledBuilderStateSignatureRef = useRef(serializeBuilderState(builderState).toString());

  useEffect(() => {
    courseDetailsRef.current = courseDetails;
  }, [courseDetails]);

  useEffect(() => {
    reconcilePendingBuilderStateFromUrl(
      pendingBuilderStateRef,
      pendingBuilderStateSignaturesRef,
      builderState,
      lastReconciledBuilderStateSignatureRef,
    );
  }, [builderState]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchErrorMessage(null);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchErrorMessage(null);

      try {
        const response = await fetch(
          `/api/courses/search?${new URLSearchParams({ q: trimmedQuery, limit: "8" }).toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Unable to search courses right now."));
        }

        const body = (await response.json()) as { courses?: CourseListItem[] };
        setSearchResults(Array.isArray(body.courses) ? body.courses : []);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSearchResults([]);
        setSearchErrorMessage(
          error instanceof Error ? error.message : "Unable to search courses right now.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    const requestedCourses = JSON.parse(courseDetailsRequestSignature) as string[];
    const designationsToFetch = requestedCourses.filter(
      (designation) => !courseDetailsRef.current[designation],
    );

    if (designationsToFetch.length === 0) {
      return;
    }

    setCourseDetails((currentDetails) => {
      const nextDetails = { ...currentDetails };

      for (const designation of designationsToFetch) {
        if (!nextDetails[designation]) {
          nextDetails[designation] = {
            data: null,
            loading: true,
            errorMessage: null,
          };
        }
      }

      return nextDetails;
    });

    const controllers = designationsToFetch.map((designation) => {
      const controller = new AbortController();

      void fetch(`/api/courses/${encodeURIComponent(designation)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              await readErrorMessage(response, "Unable to load section options for this course."),
            );
          }

          const body = (await response.json()) as ScheduleBuilderCourseDetailResponse;
          setCourseDetails((currentDetails) => ({
            ...currentDetails,
            [designation]: {
              data: body,
              loading: false,
              errorMessage: null,
            },
          }));
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            setCourseDetails((currentDetails) => {
              const existingDetails = currentDetails[designation];

              if (!existingDetails?.loading) {
                return currentDetails;
              }

              const nextDetails = { ...currentDetails };
              delete nextDetails[designation];
              return nextDetails;
            });
            return;
          }

          setCourseDetails((currentDetails) => ({
            ...currentDetails,
            [designation]: {
              data: null,
              loading: false,
              errorMessage:
                error instanceof Error
                  ? error.message
                  : "Unable to load section options for this course.",
            },
          }));
        });

      return controller;
    });

    return () => {
      for (const controller of controllers) {
        controller.abort();
      }
    };
  }, [courseDetailsRequestSignature]);

  useEffect(() => {
    const schedulePayload = JSON.parse(scheduleRequestSignature) as ScheduleRequestPayload;

    if (schedulePayload.courses.length === 0) {
      setSchedules([]);
      setEmptyStateReason(null);
      setRequestState("idle");
      setGenerationErrorMessage(null);
      setSelectedScheduleIndex(0);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setRequestState("loading");
      setEmptyStateReason(null);
      setGenerationErrorMessage(null);

      try {
        const response = await fetch("/api/schedules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(schedulePayload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Unable to generate schedules right now."));
        }

        const body = (await response.json()) as ScheduleBuilderSchedulesResponse;
        setSchedules(Array.isArray(body.schedules) ? body.schedules : []);
        setEmptyStateReason(body.empty_state_reason ?? null);
        setRequestState("ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSchedules([]);
        setEmptyStateReason(null);
        setRequestState("error");
        setGenerationErrorMessage(
          error instanceof Error ? error.message : "Unable to generate schedules right now.",
        );
      }
    }, GENERATION_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [retryNonce, scheduleRequestSignature]);

  useEffect(() => {
    setSelectedScheduleIndex((currentIndex) => {
      if (schedules.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, schedules.length - 1);
    });
  }, [schedules]);

  const selectedSchedule = schedules[selectedScheduleIndex] ?? null;
  const selectedCourseDetails = builderState.courses
    .map((designation) => courseDetails[designation]?.data)
    .filter((detail): detail is ScheduleBuilderCourseDetailResponse => detail !== null && detail !== undefined);
  const calendarEntries = selectedSchedule
    ? deriveScheduleCalendarEntries(selectedSchedule, selectedCourseDetails)
    : [];
  const searchResultTitles = new Map(searchResults.map((course) => [course.designation, course.title] as const));
  const interactiveBuilderState = deriveInteractiveBuilderState(
    builderState,
    pendingBuilderStateRef.current,
    pendingBuilderStateSignaturesRef.current.length > 0,
  );
  const hasPendingBuilderState = pendingBuilderStateSignaturesRef.current.length > 0;
  const pendingResultsDisplayState = derivePendingResultsDisplayState(
    builderState,
    pendingBuilderStateRef.current,
    hasPendingBuilderState,
  );
  const coursePickerState = deriveCoursePickerState(
    builderState,
    pendingBuilderStateRef.current,
    hasPendingBuilderState,
  );
  const hideGeneratedSchedulePreview = shouldHideGeneratedSchedulePreview(
    hasPendingBuilderState,
    requestState,
  );
  const visibleSchedules = pendingResultsDisplayState ? [] : schedules;
  const visibleRequestState = pendingResultsDisplayState?.requestState ?? requestState;
  const visibleZeroLimit = pendingResultsDisplayState?.zeroLimit ?? interactiveBuilderState.limit === 0;
  const visibleSelectedSchedule = hideGeneratedSchedulePreview ? null : selectedSchedule;
  const visibleCalendarEntries = hideGeneratedSchedulePreview ? [] : calendarEntries;

  function replaceBuilderState(nextState: ScheduleBuilderState, previousSearchParams: string) {
    const nextSearchParams = serializeBuilderState(nextState).toString();
    const currentSearchParams = searchParams.toString();

    if (nextSearchParams === currentSearchParams) {
      replacePendingBuilderStateSignature(
        pendingBuilderStateSignaturesRef,
        previousSearchParams,
        nextSearchParams,
        currentSearchParams,
      );
      return;
    }

    replacePendingBuilderStateSignature(
      pendingBuilderStateSignaturesRef,
      previousSearchParams,
      nextSearchParams,
      currentSearchParams,
    );

    startTransition(() => {
      router.replace(nextSearchParams ? `${pathname}?${nextSearchParams}` : pathname, {
        scroll: false,
      });
    });
  }

  function updateBuilderState(updater: (state: ScheduleBuilderState) => ScheduleBuilderState) {
    const previousSearchParams = serializeBuilderState(pendingBuilderStateRef.current).toString();
    const { nextState, changed } = applyPendingBuilderStateUpdate(pendingBuilderStateRef, updater);

    if (!changed) {
      return;
    }

    replaceBuilderState(nextState, previousSearchParams);
  }

  function handleAddCourse(designation: string) {
    if (coursePickerState.maxCoursesReached) {
      return;
    }

    const nextState = addCourse(pendingBuilderStateRef.current, designation);

    if (nextState === pendingBuilderStateRef.current) {
      return;
    }

    updateBuilderState(() => nextState);
    setSearchQuery("");
    setSearchResults([]);
    setSearchErrorMessage(null);
  }

  function handleRemoveCourse(designation: string) {
    updateBuilderState((state) => removeCourse(state, designation));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <CoursePicker
          query={searchQuery}
          results={searchResults}
          selectedCourseDesignations={coursePickerState.selectedCourseDesignations}
          loading={searchLoading}
          errorMessage={searchErrorMessage}
          maxCoursesReached={coursePickerState.maxCoursesReached}
          onQueryChange={setSearchQuery}
          onAddCourse={handleAddCourse}
        />

        <SelectedCourseList
          courses={builderState.courses.map((designation) => {
            const record = courseDetails[designation];

            return {
              designation,
              title: record?.data?.course.title ?? searchResultTitles.get(designation) ?? null,
              loading: record?.loading ?? false,
              errorMessage: record?.errorMessage ?? null,
            };
          })}
          onRemoveCourse={handleRemoveCourse}
        />

        <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-surface p-5 shadow-soft">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">
              Settings
            </h2>
            <p className="text-sm leading-7 text-text-weak">
              Your courses, section choices, and preferences are saved in the URL and can be shared. Generated schedules themselves are not included.
            </p>
          </div>

          <SchedulePriorityList
            preferenceOrder={interactiveBuilderState.preferenceOrder}
            onMoveRule={(ruleId, direction) => {
              updateBuilderState((state) => movePreferenceRule(state, ruleId, direction));
            }}
            onRuleEnabledChange={(ruleId, enabled) => {
              updateBuilderState((state) => setPreferenceRuleEnabled(state, ruleId, enabled));
            }}
          />

          <label className="flex flex-col gap-3 text-sm font-medium text-text-weak" htmlFor="schedule-builder-limit">
            Max results
            <input
              id="schedule-builder-limit"
              type="number"
              min={0}
              max={50}
              value={interactiveBuilderState.limit}
              onChange={(event) => {
                updateBuilderState((state) => ({
                  ...state,
                  limit: clampScheduleLimit(Number.parseInt(event.target.value, 10)),
                }));
              }}
              className="min-h-12 rounded-2xl border border-border bg-transparent px-4 text-base font-normal outline-none transition focus:border-blue"
            />
          </label>

          <ScheduleAvailabilityFilters
            includeWaitlisted={interactiveBuilderState.includeWaitlisted}
            includeClosed={interactiveBuilderState.includeClosed}
            onIncludeWaitlistedChange={(checked) => {
              updateBuilderState((state) => ({ ...state, includeWaitlisted: checked }));
            }}
            onIncludeClosedChange={(checked) => {
              updateBuilderState((state) => ({ ...state, includeClosed: checked }));
            }}
          />

          <div className="rounded-3xl border border-border bg-muted p-4 text-sm leading-7 text-text-weak">
            {isRoutingPending ? "Updating..." : "Schedules regenerate automatically when your inputs change."}
          </div>
        </section>

        {builderState.courses.map((designation) => {
          const record = courseDetails[designation];
          const title = record?.data?.course.title ?? searchResultTitles.get(designation) ?? null;

          return (
            <SectionOptionPanel
              key={designation}
              course={record?.data ?? buildFallbackCourseDetail(designation, title)}
              lockedSectionId={
                builderState.lockedSections.find(
                  (lockedSection) => lockedSection.courseDesignation === designation,
                )?.sourcePackageId ?? null
              }
              excludedSectionIds={builderState.excludedSections.map(
                (excludedSection) => excludedSection.sourcePackageId,
              )}
              loading={record?.loading ?? false}
              errorMessage={record?.errorMessage ?? null}
              onLockSection={(sourcePackageId) => {
                updateBuilderState((state) => setLockedSection(state, designation, sourcePackageId));
              }}
              onExcludeSection={(sourcePackageId, excluded) => {
                updateBuilderState((state) =>
                  setExcludedSection(state, designation, sourcePackageId, excluded),
                );
              }}
            />
          );
        })}
      </div>

      <div className="sticky top-16 flex flex-col gap-3 self-start">
        <ScheduleHardFilterBar
          maxDays={interactiveBuilderState.maxDays}
          startAfterHour={interactiveBuilderState.startAfterHour}
          endBeforeHour={interactiveBuilderState.endBeforeHour}
          onMaxDaysChange={(value) => {
            updateBuilderState((state) => ({ ...state, maxDays: value }));
          }}
          onStartAfterHourChange={(value) => {
            updateBuilderState((state) => ({ ...state, startAfterHour: value }));
          }}
          onEndBeforeHourChange={(value) => {
            updateBuilderState((state) => ({ ...state, endBeforeHour: value }));
          }}
        />

        <ScheduleCalendar schedule={visibleSelectedSchedule} entries={visibleCalendarEntries} />

        <ScheduleResults
          schedules={visibleSchedules}
          emptyStateReason={emptyStateReason}
          preferenceOrder={interactiveBuilderState.preferenceOrder}
          selectedScheduleIndex={selectedScheduleIndex}
          requestState={visibleRequestState}
          loading={visibleRequestState === "loading"}
          errorMessage={generationErrorMessage}
          zeroLimit={visibleZeroLimit}
          onRetry={() => setRetryNonce((currentValue) => currentValue + 1)}
          onSelectSchedule={setSelectedScheduleIndex}
        />
      </div>
    </div>
  );
}
