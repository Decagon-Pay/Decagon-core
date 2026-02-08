#!/usr/bin/env npx tsx
/**
 * Idempotency Test Script
 * 
 * Tests:
 *   1. Create a challenge (GET /article/:id → 402)
 *   2. Verify with txRef X → should succeed, mint credits
 *   3. Record credits after first verify
 *   4. Verify AGAIN with same txRef X → should return SAME receipt, credits unchanged
 *   5. Access article → should succeed (full content, 1 credit deducted)
 *   6. Verify credits decremented by exactly 1
 *
 * Usage:
 *   npx tsx scripts/test-idempotency.ts [API_BASE]
 *   # defaults to http://localhost:3001
 */

const API_BASE = process.argv[2] || "http://localhost:3001";

const ARTICLE_ID = "a1";
const MOCK_TX_REF = `idempotency_test_${Date.now()}`;

interface Challenge {
  challengeId: string;
  resourceId: string;
  amountRequired: number;
}

interface VerifyResponse {
  success: boolean;
  receipt: {
    receiptId: string;
    challengeId: string;
    transactionRef: string;
    creditsPurchased: number;
  };
  sessionToken: {
    tokenId: string;
    credits: number;
  };
  message: string;
}

interface BalanceResponse {
  credits: number;
  expiresAt: string;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log(`\n🧪 Decagon Idempotency Test`);
  console.log(`   API: ${API_BASE}\n`);

  // ── Step 1: Get challenge ────────────────────────────────────
  console.log("Step 1: Trigger 402 to get PaymentChallenge");
  const articleRes = await fetch(`${API_BASE}/article/${ARTICLE_ID}`);
  assert(articleRes.status === 402, "Article returns 402 (payment required)");
  const articleData = await articleRes.json();
  const challenge: Challenge = articleData.challenge;
  assert(!!challenge.challengeId, `Got challengeId: ${challenge.challengeId}`);

  // ── Step 2: First verify ─────────────────────────────────────
  console.log("\nStep 2: First /pay/verify with mock txRef");
  const verify1Res = await fetch(`${API_BASE}/pay/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      transactionRef: MOCK_TX_REF,
      payerAddress: "0xTestIdempotency",
    }),
  });
  assert(verify1Res.ok, `Verify #1 succeeded (HTTP ${verify1Res.status})`);
  const verify1: VerifyResponse = await verify1Res.json();
  assert(verify1.success === true, "Receipt issued");
  const receiptId1 = verify1.receipt.receiptId;
  const sessionToken = verify1.sessionToken.tokenId;
  const creditsAfterVerify1 = verify1.sessionToken.credits;
  console.log(`   receiptId=${receiptId1} credits=${creditsAfterVerify1} sessionToken=${sessionToken.slice(0, 8)}…`);

  // ── Step 3: Check credits via balance endpoint ───────────────
  console.log("\nStep 3: Confirm credits via /credits/balance");
  const balanceRes1 = await fetch(`${API_BASE}/credits/balance`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  assert(balanceRes1.ok, "Balance endpoint OK");
  const balance1: BalanceResponse = await balanceRes1.json();
  assert(balance1.credits === creditsAfterVerify1, `Credits match: ${balance1.credits}`);

  // ── Step 4: Second verify (same txRef) → IDEMPOTENT ──────────
  console.log("\nStep 4: Second /pay/verify with SAME txRef (idempotency check)");
  const verify2Res = await fetch(`${API_BASE}/pay/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      transactionRef: MOCK_TX_REF,
      payerAddress: "0xTestIdempotency",
    }),
  });
  assert(verify2Res.ok, `Verify #2 succeeded (HTTP ${verify2Res.status}) — idempotent return`);
  const verify2: VerifyResponse = await verify2Res.json();
  const receiptId2 = verify2.receipt.receiptId;
  assert(receiptId1 === receiptId2, `Same receiptId returned: ${receiptId2}`);

  // ── Step 5: Credits must be UNCHANGED after idempotent retry ─
  console.log("\nStep 5: Credits unchanged after idempotent retry");
  const balanceRes2 = await fetch(`${API_BASE}/credits/balance`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  assert(balanceRes2.ok, "Balance endpoint OK");
  const balance2: BalanceResponse = await balanceRes2.json();
  assert(
    balance2.credits === creditsAfterVerify1,
    `Credits unchanged: ${balance2.credits} === ${creditsAfterVerify1}`,
    `Expected ${creditsAfterVerify1}, got ${balance2.credits}`
  );

  // ── Step 6: Access article (consumes 1 credit) ──────────────
  console.log("\nStep 6: Access article with session (should consume 1 credit)");
  const articleRes2 = await fetch(`${API_BASE}/article/${ARTICLE_ID}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  assert(articleRes2.status === 200, `Article returns 200 (full access)`);
  const articleData2 = await articleRes2.json();
  assert(articleData2.hasFullAccess === true, "Has full access");

  // ── Step 7: Credits decremented by exactly 1 ────────────────
  console.log("\nStep 7: Credits decremented by exactly 1");
  const balanceRes3 = await fetch(`${API_BASE}/credits/balance`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  assert(balanceRes3.ok, "Balance endpoint OK");
  const balance3: BalanceResponse = await balanceRes3.json();
  assert(
    balance3.credits === creditsAfterVerify1 - 1,
    `Credits = ${balance3.credits} (was ${creditsAfterVerify1}, expected ${creditsAfterVerify1 - 1})`,
    `Expected ${creditsAfterVerify1 - 1}, got ${balance3.credits}`
  );

  // ── Summary ──────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("❌ SOME TESTS FAILED");
    process.exit(1);
  } else {
    console.log("✅ ALL TESTS PASSED");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
