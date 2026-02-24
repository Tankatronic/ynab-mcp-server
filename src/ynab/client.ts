import * as ynab from "ynab";
import { setToken } from "../utils/errors.js";
import { trackRateLimit, type RateLimitInfo } from "./rate-limit.js";

let apiInstance: ynab.API | null = null;

export function initYnabClient(): void {
  const token = process.env.YNAB_API_TOKEN;
  if (!token) {
    throw new Error(
      "YNAB_API_TOKEN environment variable is required. " +
        "Get a personal access token from https://app.ynab.com/settings/developer",
    );
  }
  setToken(token);
  apiInstance = new ynab.API(token);
}

export function getYnabClient(): ynab.API {
  if (!apiInstance) {
    initYnabClient();
  }
  return apiInstance!;
}

export function getRateLimitInfo(): RateLimitInfo {
  return trackRateLimit();
}

// Re-export the ynab namespace for type access
export { ynab };
