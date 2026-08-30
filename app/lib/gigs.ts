export const GIG_CATEGORIES = [
  "Design",
  "Development",
  "Writing",
  "Research",
  "Photography",
  "Video",
  "Tutoring",
  "Other",
] as const;

export type GigCategory = (typeof GIG_CATEGORIES)[number];
export const MARKETPLACE_GIG_STATUSES = [
  "draft",
  "open",
  "hired",
  "terms_pending",
  "awaiting_funding",
  "in_progress",
  "submitted",
  "completed",
  "disputed",
  "cancelled",
] as const;

export type MarketplaceGigStatus = (typeof MARKETPLACE_GIG_STATUSES)[number];
export type SettlementPreference = "local" | "usdc";
export type MarketplaceApplicationStatus = "pending" | "accepted" | "rejected";
export type MarketplaceAgreementStatus = "draft" | "proposed" | "accepted";
export type MarketplacePaymentStatus =
  | "awaiting_funding"
  | "funding_pending"
  | "funded"
  | "submitted"
  | "disputed"
  | "approved"
  | "releasing"
  | "released"
  | "completed"
  | "failed"
  | "refunded";

export type MarketplaceGig = {
  id: string;
  ownerId: string;
  title: string;
  summary: string;
  description: string;
  category: GigCategory;
  country: string;
  currency: string;
  settlementPreference: SettlementPreference;
  budget: number;
  deadline: string;
  status: MarketplaceGigStatus;
  version: number;
  applicantCount: number;
  posterName: string;
  posterUniversity: string;
  selectedApplicantId: string;
  selectedApplicantName: string;
  agreementStatus?: MarketplaceAgreementStatus;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceAgreement = {
  scope: string;
  deliverables: string;
  deadline: string;
  amount: number;
  currency: string;
  revisions: number;
};

export type MarketplaceConversation = {
  gigId: string;
  ownerId: string;
  studentId: string;
  ownerName: string;
  studentName: string;
  agreement: MarketplaceAgreement;
  agreementStatus: MarketplaceAgreementStatus;
  agreementVersion: number;
  acceptedVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "client" | "student" | "system";
  text: string;
  createdAt: string;
};

export type MarketplacePayment = {
  gigId: string;
  clientId: string;
  studentId: string;
  settlementMethod: "solana_custodial" | "local";
  currency: string;
  amountBaseUnits: string;
  platformFeeBaseUnits: string;
  studentAmountBaseUnits: string;
  escrowOwnerAddress: string;
  escrowAddress: string;
  feePayerAddress: string;
  feesSponsored: boolean;
  fundingSignature: string;
  releaseSignature: string;
  status: MarketplacePaymentStatus;
  failureReason: string;
  createdAt: string;
  fundedAt: string;
  releasedAt: string;
  completedAt: string;
  updatedAt: string;
};

export type MarketplaceWorkSubmissionStatus =
  | "submitted"
  | "changes_requested"
  | "approved";

export type MarketplaceWorkSubmission = {
  gigId: string;
  clientId: string;
  studentId: string;
  summary: string;
  deliverableUrl: string;
  status: MarketplaceWorkSubmissionStatus;
  revisionNumber: number;
  clientFeedback: string;
  submittedAt: string;
  reviewedAt: string;
  updatedAt: string;
};

export type MarketplaceApplicantProfile = {
  fullName: string;
  email: string;
  university: string;
  course: string;
  headline: string;
  bio: string;
  skills: string;
  portfolio: string;
  linkedIn: string;
  gitHub: string;
  availability: string;
  photoDataUrl: string;
  studentVerified: boolean;
  completedGigCount: number;
  ratingCount: number;
  averageRating: number;
  totalEarnedUsdcBaseUnits: string;
};

export type MarketplaceApplication = {
  id: string;
  gigId: string;
  applicantId: string;
  applicantName: string;
  applicantUniversity: string;
  note: string;
  status: MarketplaceApplicationStatus;
  createdAt: string;
  updatedAt: string;
  profile?: MarketplaceApplicantProfile;
  gig?: MarketplaceGig;
};
