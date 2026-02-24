/**
 * Rate limit tracking for YNAB API.
 * YNAB allows 200 requests per hour per access token.
 *
 * Since the ynab SDK doesn't directly expose rate limit headers,
 * we track rate limit info from error responses (429s).
 */

export interface RateLimitInfo {
  requestsRemaining: number | null;
  resetsAt: Date | null;
  isLimited: boolean;
}

let lastKnownLimit: RateLimitInfo = {
  requestsRemaining: null,
  resetsAt: null,
  isLimited: false,
};

export function trackRateLimit(): RateLimitInfo {
  // If we were rate limited and the reset time has passed, clear the flag
  if (lastKnownLimit.isLimited && lastKnownLimit.resetsAt) {
    if (new Date() > lastKnownLimit.resetsAt) {
      lastKnownLimit = {
        requestsRemaining: null,
        resetsAt: null,
        isLimited: false,
      };
    }
  }
  return { ...lastKnownLimit };
}

export function markRateLimited(): void {
  const resetTime = new Date();
  resetTime.setMinutes(resetTime.getMinutes() + 15);

  lastKnownLimit = {
    requestsRemaining: 0,
    resetsAt: resetTime,
    isLimited: true,
  };
}

export function clearRateLimit(): void {
  lastKnownLimit = {
    requestsRemaining: null,
    resetsAt: null,
    isLimited: false,
  };
}
