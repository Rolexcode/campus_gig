import {
  apiErrorResponse,
  requireFirebaseUser,
  tokenHasAdminEmail,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const decoded = await requireFirebaseUser(request);
    return Response.json({
      isAdmin: tokenHasAdminEmail(decoded),
      emailVerified: decoded.email_verified === true,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
