import { describe, expect, it } from "vitest";
import {
  agreementDigest,
  encodeFundEscrowInstruction,
  encodeOpenDisputeInstruction,
  encodeReleaseInstruction,
  gigIdDigest,
} from "./program-escrow-codec";

describe("CampusGig Anchor instruction codec", () => {
  it("creates deterministic domain-separated gig and agreement hashes", () => {
    const gigHash = gigIdDigest("gig_123");
    const agreement = {
      gigId: "gig_123",
      agreementVersion: 2,
      clientId: "client",
      workerId: "worker",
      scope: "Build the verified landing page",
      deliverables: "Source code and deployment",
      deadline: "2026-09-30",
      amountBaseUnits: "100000000",
      currency: "USDC",
      revisions: 2,
    };
    expect(gigHash).toHaveLength(32);
    expect(agreementDigest(agreement)).toEqual(agreementDigest({ ...agreement }));
    expect(gigHash).not.toEqual(agreementDigest(agreement));
  });

  it("encodes the exact Anchor fund instruction width", () => {
    const data = encodeFundEscrowInstruction({
      gigIdHash: Buffer.alloc(32, 1),
      agreementHash: Buffer.alloc(32, 2),
      amountBaseUnits: 100_000_000n,
      feeBps: 500,
      deadlineUnixSeconds: 1_800_000_000n,
    });
    expect(data).toHaveLength(8 + 32 + 32 + 8 + 2 + 8);
    expect(data.readBigUInt64LE(72)).toBe(100_000_000n);
    expect(data.readUInt16LE(80)).toBe(500);
    expect(data.readBigInt64LE(82)).toBe(1_800_000_000n);
  });

  it("encodes release and dispute discriminators without user-controlled bytes", () => {
    expect(encodeReleaseInstruction()).toHaveLength(8);
    expect(encodeOpenDisputeInstruction(Buffer.alloc(32, 9))).toHaveLength(40);
  });
});
