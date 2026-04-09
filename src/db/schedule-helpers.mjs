export const SCHEDULE_TIMEZONE = 'America/Chicago';

export const DAY_BITS = Object.freeze({
  M: 1,
  T: 2,
  W: 4,
  R: 8,
  F: 16,
  S: 32,
  U: 64,
});

const localDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHEDULE_TIMEZONE,
  month: 'short',
  day: 'numeric',
});

export function makeDaysMask(meetingDays) {
  if (typeof meetingDays !== 'string' || meetingDays.trim() === '') {
    return null;
  }

  let mask = 0;
  for (const day of meetingDays.toUpperCase()) {
    mask |= DAY_BITS[day] ?? 0;
  }

  return mask === 0 ? null : mask;
}

export function countBits(value) {
  let bits = value ?? 0;
  let count = 0;

  while (bits > 0) {
    count += bits & 1;
    bits >>= 1;
  }

  return count;
}

export function expandDaysMask(daysMask) {
  if (daysMask == null) {
    return [];
  }

  return Object.values(DAY_BITS).filter((bit) => (daysMask & bit) !== 0);
}

export function meetingTimeToMinutes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.trunc(value / 60000);
}

export function deriveDurationMinutes(startMinutes, endMinutes) {
  if (startMinutes == null || endMinutes == null) {
    return null;
  }

  return Math.max(endMinutes - startMinutes, 0);
}

export function isOnlineInstructionMode(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return /online|asynchronous|distance/i.test(value);
}

export function formatMinutesLocal(minutes) {
  if (minutes == null) {
    return null;
  }

  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatLocalDate(epochMilliseconds) {
  if (typeof epochMilliseconds !== 'number' || !Number.isFinite(epochMilliseconds)) {
    return null;
  }

  return localDateFormatter.format(new Date(epochMilliseconds));
}

export function summarizeSchedulableMeetings(meetings) {
  return meetings
    .map((meeting) => {
      const parts = [];

      if (meeting.meeting_days) {
        parts.push(meeting.meeting_days);
      }

      if (meeting.start_minute_local != null && meeting.end_minute_local != null) {
        parts.push(`${formatMinutesLocal(meeting.start_minute_local)}-${formatMinutesLocal(meeting.end_minute_local)}`);
      }

      if (meeting.is_online) {
        parts.push('Online');
      } else if (meeting.building_name) {
        parts.push(`@ ${meeting.building_name}`);
      } else if (meeting.room) {
        parts.push(`@ ${meeting.room}`);
      }

      return parts.join(' ');
    })
    .filter(Boolean)
    .join('; ');
}

export function parseTemporaryRestrictionFlag(restrictionNote) {
  if (typeof restrictionNote !== 'string' || restrictionNote.trim() === '') {
    return 0;
  }

  return /restriction(?:s)?[^.\n]*(?:will be|to be)?\s*(?:removed|lifted)|(?:removed|lifted)[^.\n]*restriction(?:s)?|\bon\s+[A-Z][a-z]+\s+\d{1,2}[^.\n]*(?:removed|lifted|open to all)/i.test(restrictionNote)
    ? 1
    : 0;
}

export function haversineMeters(from, to) {
  if (
    from?.latitude == null ||
    from?.longitude == null ||
    to?.latitude == null ||
    to?.longitude == null
  ) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
