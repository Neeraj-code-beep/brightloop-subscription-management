/**
 * Billing Cycle & Interval Calculation Utility
 * Provides deterministic date math, month-end date clamping, and cycle validation.
 */

export const BILLING_CYCLES = Object.freeze({
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  HALF_YEARLY: 'HALF_YEARLY',
  YEARLY: 'YEARLY',
  CUSTOM: 'CUSTOM'
});

export const CUSTOM_BILLING_UNITS = Object.freeze({
  DAYS: 'DAYS',
  WEEKS: 'WEEKS',
  MONTHS: 'MONTHS',
  YEARS: 'YEARS'
});

/**
 * Add calendar months to a UTC Date safely, clamping to the last valid day of the target month.
 * Handles leap years, month-end rollovers (e.g. Jan 31 -> Feb 28/29, Mar 31 -> Apr 30),
 * and preserves exact time components.
 *
 * @param {Date|string|number} date - Starting Date
 * @param {number} monthsToAdd - Number of months to advance
 * @returns {Date}
 */
export function addMonthsSafe(date, monthsToAdd) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date provided to addMonthsSafe: ${date}`);
  }

  const originalDay = d.getUTCDate();
  const originalHours = d.getUTCHours();
  const originalMinutes = d.getUTCMinutes();
  const originalSeconds = d.getUTCSeconds();
  const originalMs = d.getUTCMilliseconds();

  const totalMonths = d.getUTCFullYear() * 12 + d.getUTCMonth() + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  // Day 0 of the following month gives the maximum days in targetMonth
  const maxDaysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(originalDay, maxDaysInTargetMonth);

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    clampedDay,
    originalHours,
    originalMinutes,
    originalSeconds,
    originalMs
  ));
}

/**
 * Calculate the next billing date for a subscription or quotation based on cycle and start date.
 *
 * @param {Date|string|number} startDate - Effective starting date
 * @param {'MONTHLY'|'QUARTERLY'|'HALF_YEARLY'|'YEARLY'|'CUSTOM'} billingCycle
 * @param {number} [customDuration] - Positive integer required if billingCycle === 'CUSTOM'
 * @param {'DAYS'|'WEEKS'|'MONTHS'|'YEARS'} [customDurationUnit] - Required if billingCycle === 'CUSTOM'
 * @returns {Date} The calculated next billing date
 */
export function calculateNextBillingDate(startDate, billingCycle, customDuration, customDurationUnit) {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid start date: ${startDate}`);
  }

  switch (billingCycle) {
    case BILLING_CYCLES.MONTHLY:
      return addMonthsSafe(start, 1);

    case BILLING_CYCLES.QUARTERLY:
      return addMonthsSafe(start, 3);

    case BILLING_CYCLES.HALF_YEARLY:
      return addMonthsSafe(start, 6);

    case BILLING_CYCLES.YEARLY:
      return addMonthsSafe(start, 12);

    case BILLING_CYCLES.CUSTOM: {
      if (!customDuration || customDuration < 1) {
        throw new Error('Custom billing cycle requires a positive customDuration integer.');
      }
      if (!customDurationUnit || !CUSTOM_BILLING_UNITS[customDurationUnit]) {
        throw new Error(`Custom billing cycle requires a valid customDurationUnit (${Object.keys(CUSTOM_BILLING_UNITS).join(', ')}).`);
      }

      const duration = parseInt(customDuration, 10);

      switch (customDurationUnit) {
        case CUSTOM_BILLING_UNITS.DAYS:
          return new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

        case CUSTOM_BILLING_UNITS.WEEKS:
          return new Date(start.getTime() + duration * 7 * 24 * 60 * 60 * 1000);

        case CUSTOM_BILLING_UNITS.MONTHS:
          return addMonthsSafe(start, duration);

        case CUSTOM_BILLING_UNITS.YEARS:
          return addMonthsSafe(start, duration * 12);

        default:
          throw new Error(`Unsupported customDurationUnit: ${customDurationUnit}`);
      }
    }

    default:
      throw new Error(`Unsupported billing cycle: ${billingCycle}`);
  }
}

/**
 * Validate billing cycle configuration consistency.
 *
 * @param {object} params
 * @param {string} params.billingCycle
 * @param {number} [params.customDuration]
 * @param {string} [params.customDurationUnit]
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateBillingCycleConfig({ billingCycle, customDuration, customDurationUnit }) {
  if (!BILLING_CYCLES[billingCycle]) {
    return {
      valid: false,
      error: `billingCycle must be one of: ${Object.values(BILLING_CYCLES).join(', ')}`
    };
  }

  if (billingCycle === BILLING_CYCLES.CUSTOM) {
    if (customDuration === undefined || customDuration === null || isNaN(customDuration) || customDuration < 1) {
      return {
        valid: false,
        error: "customDuration is required and must be a positive integer greater than or equal to 1 when billingCycle is 'CUSTOM'."
      };
    }
    if (!customDurationUnit || !CUSTOM_BILLING_UNITS[customDurationUnit]) {
      return {
        valid: false,
        error: `customDurationUnit is required and must be one of: ${Object.values(CUSTOM_BILLING_UNITS).join(', ')} when billingCycle is 'CUSTOM'.`
      };
    }
  } else {
    if (customDuration !== undefined && customDuration !== null) {
      return {
        valid: false,
        error: "customDuration must only be provided when billingCycle is 'CUSTOM'."
      };
    }
    if (customDurationUnit !== undefined && customDurationUnit !== null) {
      return {
        valid: false,
        error: "customDurationUnit must only be provided when billingCycle is 'CUSTOM'."
      };
    }
  }

  return { valid: true };
}

