import {
  apiErrorResponse,
  requireConfiguredAdminEmail,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const decoded = await requireConfiguredAdminEmail(request);
    return Response.json({
      registered: true,
      email: decoded.email ?? "",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
