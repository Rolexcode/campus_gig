import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import {
  GIG_CATEGORIES,
  type GigCategory,
  type MarketplaceGig,
  type SettlementPreference,
} from "@/app/lib/gigs";
import {
  apiErrorResponse,
  ApiAuthError,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

const allowedCurrencies: Record<string, string> = {
  Nigeria: "NGN",
  Ghana: "GHS",
  Kenya: "KES",
  "South Africa": "ZAR",
  Uganda: "UGX",
  Rwanda: "RWF",
  Canada: "CAD",
  "United Kingdom": "GBP",
  "United States": "USD",
  Singapore: "SGD",
};

function cleanText(value: unknown, maximum: number) {
  const text = String(value ?? "")
    .trim()
    .replace(/\r\n/g, "\n");
  if (text.length > maximum)
    throw new ApiAuthError(`Keep this field under ${maximum} characters.`, 400);
  return text;
}

function isoDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return "";
}

function gigFromDocument(
  id: string,
  data: Record<string, unknown>,
): MarketplaceGig {
  return {
    id,
    ownerId: String(data.ownerId ?? ""),
    title: String(data.title ?? ""),
    summary: String(data.summary ?? ""),
    description: String(data.description ?? ""),
    category: String(data.category ?? "Other") as GigCategory,
    country: String(data.country ?? ""),
    currency: String(data.currency ?? ""),
    settlementPreference: String(
      data.settlementPreference ?? "local",
    ) as SettlementPreference,
    budget: Number(data.budget ?? 0),
    deadline: String(data.deadline ?? ""),
    status: String(data.status ?? "open") as MarketplaceGig["status"],
    applicantCount: Number(data.applicantCount ?? 0),
    posterName: String(data.posterName ?? "CampusGig member"),
    posterUniversity: String(data.posterUniversity ?? "Institution not added"),
    selectedApplicantId: String(data.selectedApplicantId ?? ""),
    selectedApplicantName: String(data.selectedApplicantName ?? ""),
    agreementStatus:
      data.agreementStatus === "accepted"
        ? "accepted"
        : data.agreementStatus === "proposed"
          ? "proposed"
          : "draft",
    createdAt: isoDate(data.createdAt),
    updatedAt: isoDate(data.updatedAt),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mine = url.searchParams.get("mine") === "1";
    const { adminDb } = getFirebaseAdminServices();
    let ownerId = "";

    if (mine) ownerId = (await requireMarketplaceUser(request)).uid;

    let query: FirebaseFirestore.Query = adminDb.collection("gigs");
    if (mine) query = query.where("ownerId", "==", ownerId);
    else query = query.where("status", "==", "open");

    const snapshot = await query.get();
    const gigs = snapshot.docs
      .map((document) => gigFromDocument(document.id, document.data()))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return Response.json({ gigs });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const body = await request.json().catch(() => ({}));
    const title = cleanText(body.title, 90);
    const summary = cleanText(body.summary, 220);
    const description = cleanText(body.description, 1_500);
    const category = cleanText(body.category, 40) as GigCategory;
    const country = cleanText(body.country, 80);
    const deadline = cleanText(body.deadline, 10);
    const settlementPreference = cleanText(
      body.settlementPreference,
      10,
    ) as SettlementPreference;
    const budget = Number(body.budget);

    if (title.length < 8)
      throw new ApiAuthError("Use a more specific gig title.", 400);
    if (summary.length < 20)
      throw new ApiAuthError(
        "Add a short summary of at least 20 characters.",
        400,
      );
    if (description.length < 40)
      throw new ApiAuthError(
        "Describe the task in at least 40 characters.",
        400,
      );
    if (!GIG_CATEGORIES.includes(category))
      throw new ApiAuthError("Choose a valid gig category.", 400);
    if (!allowedCurrencies[country])
      throw new ApiAuthError("Choose a supported country.", 400);
    if (settlementPreference !== "local" && settlementPreference !== "usdc")
      throw new ApiAuthError("Choose local currency or USDC settlement.", 400);
    if (!Number.isFinite(budget) || budget <= 0 || budget > 1_000_000_000_000)
      throw new ApiAuthError("Enter a valid budget.", 400);
    if (settlementPreference === "local" && !Number.isSafeInteger(budget))
      throw new ApiAuthError(
        "Enter a whole-number local-currency budget.",
        400,
      );
    if (
      settlementPreference === "usdc" &&
      Math.round(budget * 100) !== budget * 100
    )
      throw new ApiAuthError(
        "Use no more than two decimal places for USDC.",
        400,
      );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline))
      throw new ApiAuthError("Choose a valid deadline.", 400);
    const deadlineDate = new Date(`${deadline}T23:59:59.999Z`);
    if (
      Number.isNaN(deadlineDate.getTime()) ||
      deadlineDate.getTime() < Date.now()
    ) {
      throw new ApiAuthError("Choose a deadline that has not passed.", 400);
    }

    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const [profileSnapshot, authUser] = await Promise.all([
      adminDb.collection("users").doc(decoded.uid).get(),
      adminAuth.getUser(decoded.uid),
    ]);
    if (!profileSnapshot.exists)
      throw new ApiAuthError(
        "Create your CampusGig profile before posting a gig.",
        403,
      );
    const profile = profileSnapshot.data() ?? {};
    const posterName = cleanText(
      profile.fullName || authUser.displayName || "CampusGig member",
      100,
    );
    const posterUniversity = cleanText(
      profile.university || "Institution not added",
      180,
    );

    const document = adminDb.collection("gigs").doc();
    const record = {
      ownerId: decoded.uid,
      title,
      summary,
      description,
      category,
      country,
      currency:
        settlementPreference === "usdc" ? "USDC" : allowedCurrencies[country],
      settlementPreference,
      budget,
      deadline,
      status: "open",
      applicantCount: 0,
      posterName,
      posterUniversity,
      selectedApplicantId: "",
      selectedApplicantName: "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await document.create(record);
    const created = await document.get();

    return Response.json(
      { gig: gigFromDocument(created.id, created.data() ?? record) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
