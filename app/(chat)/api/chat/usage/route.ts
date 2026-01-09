import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { getChatApiCallCountByUserId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ApiCallsUsage } from "@/lib/types";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const used = await getChatApiCallCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    const max = entitlementsByUserType[userType].maxChatApiCallsPerDay;

    const usage: ApiCallsUsage = {
      used,
      max,
      userType,
    };

    return Response.json(usage);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError("bad_request:api").toResponse();
  }
}
