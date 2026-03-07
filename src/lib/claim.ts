export type ClaimStatus = "unclaimed" | "pending" | "claimed";
export type VerificationStatus = "unverified" | "pending" | "verified";

export interface ClaimableCompany {
  claimStatus?: ClaimStatus;
  verificationStatus?: VerificationStatus;
  lastVerifiedAt?: string | null;
  claimedAt?: string | null;
}

export function getClaimStatus(company: ClaimableCompany): ClaimStatus {
  return company.claimStatus ?? "unclaimed";
}

export function isClaimed(company: ClaimableCompany): boolean {
  return getClaimStatus(company) === "claimed";
}

export function isClaimPending(company: ClaimableCompany): boolean {
  return getClaimStatus(company) === "pending";
}

export function getVerificationStatus(
  company: ClaimableCompany
): VerificationStatus {
  return company.verificationStatus ?? "unverified";
}

export function isVerified(company: ClaimableCompany): boolean {
  return getVerificationStatus(company) === "verified";
}
