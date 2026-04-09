import test from 'node:test';
import assert from 'node:assert/strict';

import { formatMinutesLocal, meetingTimeToMinutes } from '../src/db/schedule-helpers.mjs';

test('meetingTimeToMinutes converts source clock values into Chicago local minutes', () => {
  const engl462Section1Start = meetingTimeToMinutes(61200000);
  const engl462Section2Start = meetingTimeToMinutes(69600000);

  assert.equal(engl462Section1Start, 660);
  assert.equal(formatMinutesLocal(engl462Section1Start), '11:00 AM');
  assert.equal(engl462Section2Start, 800);
  assert.equal(formatMinutesLocal(engl462Section2Start), '1:20 PM');
});
