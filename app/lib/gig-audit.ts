import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type {
  DocumentReference,
  Transaction,
} from "firebase-admin/firestore";
import type {
  GigActorRole,
  GigEventType,
} from "./gig-contracts";
import type { MarketplaceGigStatus } from "./gigs";

type GigEventInput = {
  id: string;
  type: GigEventType;
  actorId: string;
  actorRole: GigActorRole;
  fromStatus?: MarketplaceGigStatus | "";
  toStatus?: MarketplaceGigStatus | "";
  metadata?: Record<string, unknown>;
};

export function writeGigEvent(
  transaction: Transaction,
  gigReference: DocumentReference,
  event: GigEventInput,
) {
  const eventReference = gigReference.collection("events").doc(event.id);
  transaction.set(
    eventReference,
    {
      gigId: gigReference.id,
      type: event.type,
      actorId: event.actorId,
      actorRole: event.actorRole,
      fromStatus: event.fromStatus ?? "",
      toStatus: event.toStatus ?? "",
      metadata: event.metadata ?? {},
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
}
