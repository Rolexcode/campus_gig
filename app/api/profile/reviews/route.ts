import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireMarketplaceUser } from "@/app/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { adminDb } = getFirebaseAdminServices();
    const snapshot = await adminDb
      .collection("gigReviews")
      .where("studentId", "==", decoded.uid)
      .limit(100)
      .get();
    const reviews = snapshot.docs
      .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          gigId: String(data.gigId ?? document.id),
          clientName: String(data.clientName ?? "CampusGig client"),
          rating: Number(data.rating ?? 0),
          review: String(data.review ?? ""),
          createdAt: dateValue(data.createdAt),
        };
      })
      .filter((item) => Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5)
      .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")));
    return Response.json({ reviews });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
