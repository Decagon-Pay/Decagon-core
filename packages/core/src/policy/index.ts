/**
 * Policy Module Index
 * 
 * Re-exports pure policy enforcement functions.
 */

export {
  checkPolicy,
  pathMatches,
  originMatches,
  canAutoApprove,
  getTodayKey,
  makeSubjectId,
  type PolicyCheckInput,
} from "./check-policy.js";
