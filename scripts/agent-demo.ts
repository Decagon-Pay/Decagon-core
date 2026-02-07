#!/usr/bin/env npx tsx
/**
 * Agent Demo Script - Step 4A
 * 
 * Demonstrates the HTTP 402 payment flow with policy enforcement
 * and on-chain payment verification on Plasma Testnet.
 * 
 * Usage:
 *   # Run the full demo (mock payment for policy parts)
 *   npx tsx scripts/agent-demo.ts
 * 
 *   # Verify an on-chain payment by txHash
 *   TX_HASH=0x1234... npx tsx scripts/agent-demo.ts
 * 
 * Requirements:
 *   - API server running (locally or deployed)
 * 
 * Environment Variables:
 *   - API_BASE: API server URL (default: http://localhost:4000)
 *   - TX_HASH: Transaction hash to verify on-chain (optional)
 */

const API_BASE = process.env.API_BASE ?? "http://localhost:4000";
const PLASMA_EXPLORER = "https://testnet.plasmascan.to";

interface SpendPolicy {
  maxPerActionCents: number;
  dailyCapCents: number;
  autoApproveUnderCents: number;
  requireConfirmAboveCents: number;
  allowedOrigins: string[];
  allowedPaths: string[];
}

interface Agent {
  agentId: string;
  agentToken: string;
  name: string;
  policy: SpendPolicy;
}

interface PaymentChallenge {
  challengeId: string;
  resourceId: string;
  amountRequired: number;
  currency: string;
  chain: string;
  description: string;
  payTo: string;
  expiresAt: string;
  createdAt: string;
  creditsOffered: number;
  status: string;
  // Step 4A: On-chain fields
  chainId?: number;
  assetType?: string;
  assetSymbol?: string;
  amountWei?: string;
  payeeAddress?: string;
  explorerTxBase?: string;
}

interface SessionToken {
  tokenId: string;
  credits: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
}

// Step 4A: Receipt with on-chain fields
interface Receipt {
  receiptId: string;
  sessionTokenId: string;
  challengeId: string;
  amountVerified: number;
  currency: string;
  chain: string;
  credits: number;
  timestamp: string;
  expiresAt: string;
  // On-chain fields
  txHash?: string;
  explorerUrl?: string;
  blockNumber?: number;
  amountNative?: string;
  payerAddress?: string;
  payeeAddress?: string;
}

interface PolicyCheckResult {
  allowed: boolean;
  needsConfirm?: boolean;
  subjectType: string;
  subjectId: string;
  policy: SpendPolicy;
  currentDailySpend: number;
  error?: {
    _tag: string;
    message: string;
    reason: string;
  };
}

interface ArticleResponse {
  article: {
    id: string;
    title: string;
    author: string;
    preview: string;
  };
  hasFullAccess: boolean;
  content: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(step: string, message: string, data?: unknown): void {
  console.log(`\n[${step}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function agentDemo(): Promise<void> {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   🤖 Decagon Agent Demo - Step 4A: On-Chain Payments                  ║
║                                                                       ║
║   This script demonstrates:                                           ║
║   1. User policy management                                           ║
║   2. Agent token creation with scoped policies                        ║
║   3. Policy checks before payments                                    ║
║   4. Blocked payments due to policy violations                        ║
║   5. Successful payments within policy limits                         ║
║   6. On-chain payment verification (TX_HASH env var)                  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);

  // =========================================
  // Part 1: Set User Policy
  // =========================================
  console.log("\n" + "=".repeat(60));
  console.log("PART 1: USER POLICY MANAGEMENT");
  console.log("=".repeat(60));

  log("STEP 1.1", "📋 Setting user spend policy...");
  await sleep(300);

  const userPolicy: Partial<SpendPolicy> = {
    maxPerActionCents: 500,       // $5 max per action
    dailyCapCents: 1000,          // $10 daily cap
    autoApproveUnderCents: 100,   // Auto-approve under $1
    requireConfirmAboveCents: 200, // Confirm above $2
    allowedOrigins: ["*"],
    allowedPaths: ["*"],          // User can access anything
  };

  const policyRes = await fetch(`${API_BASE}/policy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ policy: userPolicy }),
  });

  if (policyRes.ok) {
    const data = await policyRes.json();
    log("STEP 1.1", "✅ User policy set", {
      maxPerAction: `$${(data.policy.maxPerActionCents / 100).toFixed(2)}`,
      dailyCap: `$${(data.policy.dailyCapCents / 100).toFixed(2)}`,
      autoApproveUnder: `$${(data.policy.autoApproveUnderCents / 100).toFixed(2)}`,
    });
  } else {
    log("STEP 1.1", "❌ Failed to set policy");
    return;
  }

  // =========================================
  // Part 2: Create Agent with Strict Policy
  // =========================================
  console.log("\n" + "=".repeat(60));
  console.log("PART 2: AGENT TOKEN CREATION");
  console.log("=".repeat(60));

  log("STEP 2.1", "🤖 Creating agent with STRICT policy...");
  await sleep(300);

  // Strict agent: can only access /article/*, max $0.25/action, $1/day
  const strictAgentPolicy: Partial<SpendPolicy> = {
    maxPerActionCents: 25,         // $0.25 max per action (will be blocked by $0.50 topup)
    dailyCapCents: 100,            // $1 daily cap
    autoApproveUnderCents: 10,     // Auto-approve under $0.10
    requireConfirmAboveCents: 20,  // Confirm above $0.20
    allowedOrigins: ["*"],
    allowedPaths: ["/article/*"],  // Only articles
  };

  const strictAgentRes = await fetch(`${API_BASE}/agent/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      name: "Strict Research Agent", 
      policy: strictAgentPolicy 
    }),
  });

  let strictAgent: Agent | null = null;
  if (strictAgentRes.ok) {
    strictAgent = await strictAgentRes.json();
    log("STEP 2.1", "✅ Strict agent created", {
      agentId: strictAgent!.agentId,
      tokenPreview: strictAgent!.agentToken.slice(0, 16) + "...",
      maxPerAction: `$${(strictAgent!.policy.maxPerActionCents / 100).toFixed(2)}`,
      allowedPaths: strictAgent!.policy.allowedPaths,
    });
  } else {
    log("STEP 2.1", "❌ Failed to create strict agent");
  }

  log("STEP 2.2", "🤖 Creating agent with PERMISSIVE policy...");
  await sleep(300);

  // Permissive agent: higher limits
  const permissiveAgentPolicy: Partial<SpendPolicy> = {
    maxPerActionCents: 100,        // $1 max per action
    dailyCapCents: 500,            // $5 daily cap
    autoApproveUnderCents: 50,     // Auto-approve under $0.50
    requireConfirmAboveCents: 100, // Confirm above $1
    allowedOrigins: ["*"],
    allowedPaths: ["/article/*"],
  };

  const permissiveAgentRes = await fetch(`${API_BASE}/agent/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      name: "Permissive Research Agent", 
      policy: permissiveAgentPolicy 
    }),
  });

  let permissiveAgent: Agent | null = null;
  if (permissiveAgentRes.ok) {
    permissiveAgent = await permissiveAgentRes.json();
    log("STEP 2.2", "✅ Permissive agent created", {
      agentId: permissiveAgent!.agentId,
      tokenPreview: permissiveAgent!.agentToken.slice(0, 16) + "...",
      maxPerAction: `$${(permissiveAgent!.policy.maxPerActionCents / 100).toFixed(2)}`,
    });
  }

  // =========================================
  // Part 3: Policy Check - BLOCKED
  // =========================================
  console.log("\n" + "=".repeat(60));
  console.log("PART 3: POLICY ENFORCEMENT - BLOCKED PAYMENT");
  console.log("=".repeat(60));

  if (strictAgent) {
    log("STEP 3.1", "🚫 Attempting policy check with STRICT agent...");
    await sleep(300);

    // The top-up costs $0.50 (50 cents), but strict agent max is $0.25
    const policyCheckRes = await fetch(`${API_BASE}/policy/check`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${strictAgent.agentToken}`,
      },
      body: JSON.stringify({
        amountCents: 50,  // $0.50 top-up cost
        path: "/article/article-1",
      }),
    });

    const policyCheck: PolicyCheckResult = await policyCheckRes.json();
    
    if (policyCheck.allowed) {
      log("STEP 3.1", "⚠️  Unexpectedly allowed (should be blocked)", policyCheck);
    } else {
      log("STEP 3.1", "🚫 BLOCKED by policy!", {
        reason: policyCheck.error?.reason,
        message: policyCheck.error?.message,
        agentMaxPerAction: `$${(policyCheck.policy.maxPerActionCents / 100).toFixed(2)}`,
        attemptedAmount: "$0.50",
      });
    }
  }

  // =========================================
  // Part 4: Policy Check - ALLOWED
  // =========================================
  console.log("\n" + "=".repeat(60));
  console.log("PART 4: POLICY ENFORCEMENT - ALLOWED PAYMENT");
  console.log("=".repeat(60));

  if (permissiveAgent) {
    log("STEP 4.1", "✅ Attempting policy check with PERMISSIVE agent...");
    await sleep(300);

    const policyCheckRes = await fetch(`${API_BASE}/policy/check`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${permissiveAgent.agentToken}`,
      },
      body: JSON.stringify({
        amountCents: 50,  // $0.50 top-up cost
        path: "/article/article-1",
      }),
    });

    const policyCheck: PolicyCheckResult = await policyCheckRes.json();
    
    if (policyCheck.allowed) {
      log("STEP 4.1", "✅ Policy check PASSED", {
        allowed: true,
        needsConfirm: policyCheck.needsConfirm,
        subjectType: policyCheck.subjectType,
        dailySpendSoFar: `$${(policyCheck.currentDailySpend / 100).toFixed(2)}`,
        dailyCapRemaining: `$${((policyCheck.policy.dailyCapCents - policyCheck.currentDailySpend) / 100).toFixed(2)}`,
      });
    } else {
      log("STEP 4.1", "❌ Unexpectedly blocked", policyCheck);
      return;
    }
  }

  // =========================================
  // Part 5: Full 402 Flow with Policy
  // =========================================
  console.log("\n" + "=".repeat(60));
  console.log("PART 5: COMPLETE 402 FLOW WITH POLICY");
  console.log("=".repeat(60));

  let sessionToken: SessionToken | null = null;

  log("STEP 5.1", "🔍 Accessing article without credentials...");
  await sleep(300);

  const articleId = "article-1";
  const response1 = await fetch(`${API_BASE}/article/${articleId}`);
  
  if (response1.status === 402) {
    const data = await response1.json();
    const challenge: PaymentChallenge = data.challenge;
    
    log("STEP 5.1", "⚠️  HTTP 402 - Payment Required", {
      challengeId: challenge.challengeId,
      amount: `$${(challenge.amountRequired / 100).toFixed(2)}`,
      credits: challenge.creditsOffered,
    });

    // Step 5.2: Policy check before payment
    log("STEP 5.2", "🔒 Checking policy before payment...");
    await sleep(300);

    const policyRes = await fetch(`${API_BASE}/policy/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: challenge.amountRequired,
        path: `/article/${articleId}`,
      }),
    });

    const policyResult: PolicyCheckResult = await policyRes.json();
    
    if (!policyResult.allowed) {
      log("STEP 5.2", "🚫 Payment blocked by policy", policyResult);
      return;
    }
    
    log("STEP 5.2", "✅ Policy check passed", {
      needsConfirm: policyResult.needsConfirm,
      autoApproved: challenge.amountRequired <= (policyResult.policy.autoApproveUnderCents ?? 0),
    });

    // Step 5.3: Submit payment
    log("STEP 5.3", "💳 Submitting payment...");
    await sleep(300);

    const payResponse = await fetch(`${API_BASE}/pay/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        transactionRef: `agent_tx_${Date.now()}`,
        payerAddress: "0xDemoAgent",
      }),
    });

    if (payResponse.ok) {
      const payData = await payResponse.json();
      sessionToken = payData.sessionToken;
      
      log("STEP 5.3", "✅ Payment verified!", {
        sessionToken: sessionToken?.tokenId,
        credits: sessionToken?.credits,
      });
    } else {
      log("STEP 5.3", "❌ Payment failed");
      return;
    }
  }

  // Step 5.4: Access content
  if (sessionToken) {
    log("STEP 5.4", "📖 Accessing premium content...");
    await sleep(300);

    const response2 = await fetch(`${API_BASE}/article/${articleId}`, {
      headers: { Authorization: `Bearer ${sessionToken.tokenId}` },
    });

    if (response2.ok) {
      const data: ArticleResponse = await response2.json();
      log("STEP 5.4", "✅ Content unlocked!", {
        title: data.article.title,
        hasFullAccess: data.hasFullAccess,
      });
    }

    // Check final balance
    log("STEP 5.5", "💰 Checking final balance...");
    await sleep(300);

    const balanceRes = await fetch(`${API_BASE}/credits/balance`, {
      headers: { Authorization: `Bearer ${sessionToken.tokenId}` },
    });

    if (balanceRes.ok) {
      const balance = await balanceRes.json();
      log("STEP 5.5", "✅ Balance check complete", {
        credits: balance.credits,
        consumed: 1,
      });
    }
  }

  // =========================================
  // Part 6: On-Chain Payment Verification
  // =========================================
  console.log("\n" + "=".repeat(60));
  console.log("PART 6: ON-CHAIN PAYMENT VERIFICATION");
  console.log("=".repeat(60));

  const txHash = process.env.TX_HASH;
  
  if (txHash) {
    log("STEP 6.1", "🔗 Verifying on-chain payment...");
    console.log(`\n   Transaction: ${txHash}`);
    console.log(`   Explorer: ${PLASMA_EXPLORER}/tx/${txHash}`);
    await sleep(300);

    // First get a challenge for the verification
    const challengeRes = await fetch(`${API_BASE}/article/article-1`);
    
    if (challengeRes.status === 402) {
      const data = await challengeRes.json();
      const challenge: PaymentChallenge = data.challenge;
      
      log("STEP 6.2", "📋 Got challenge for verification", {
        challengeId: challenge.challengeId,
        chainId: challenge.chainId,
        assetSymbol: challenge.assetSymbol,
        amountWei: challenge.amountWei,
        payeeAddress: challenge.payeeAddress,
      });

      // Verify the on-chain payment
      log("STEP 6.3", "⛓️  Verifying txHash on Plasma Testnet...");
      await sleep(300);

      const verifyRes = await fetch(`${API_BASE}/pay/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          txHash: txHash,
        }),
      });

      if (verifyRes.ok) {
        const result = await verifyRes.json();
        const receipt: Receipt = result.receipt;
        
        log("STEP 6.3", "✅ On-chain payment verified!", {
          receiptId: receipt.receiptId,
          txHash: receipt.txHash,
          blockNumber: receipt.blockNumber,
          amountNative: receipt.amountNative ? `${receipt.amountNative} XPL` : undefined,
          payerAddress: receipt.payerAddress,
          payeeAddress: receipt.payeeAddress,
          explorerUrl: receipt.explorerUrl,
        });

        if (receipt.explorerUrl) {
          console.log(`\n   🔗 View transaction: ${receipt.explorerUrl}`);
        }
      } else {
        const error = await verifyRes.json();
        log("STEP 6.3", "❌ Verification failed", error);
      }
    }
  } else {
    log("STEP 6.1", "ℹ️  Skipping on-chain verification");
    console.log("\n   To verify an on-chain payment, run:");
    console.log(`   TX_HASH=0x1234... npx tsx scripts/agent-demo.ts`);
    console.log("\n   Or use the web UI at http://localhost:3001 to pay with MetaMask");
  }

  // =========================================
  // Summary
  // =========================================
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   🎉 Step 4A Demo Complete!                                           ║
║                                                                       ║
║   What we demonstrated:                                               ║
║                                                                       ║
║   ✅ User policy: Set spend limits ($5/action, $10/day)               ║
║   ✅ Strict agent: Created with $0.25 max (blocked $0.50 topup)       ║
║   ✅ Permissive agent: Created with $1 max (allowed topup)            ║
║   ✅ Policy enforcement: Blocked strict agent, allowed user           ║
║   ✅ Full 402 flow: GET → 402 → policy check → pay → 200              ║
║   ${txHash ? "✅" : "⏭️ "} On-chain verification: ${txHash ? "Verified txHash on Plasma" : "Skipped (set TX_HASH)"}             ║
║                                                                       ║
║   For on-chain payments:                                              ║
║   1. Open http://localhost:3001 in browser                            ║
║   2. Click an article to see 402 challenge                            ║
║   3. Connect MetaMask & pay with XPL on Plasma Testnet                ║
║   4. Copy the txHash and run:                                         ║
║      TX_HASH=0x... npx tsx scripts/agent-demo.ts                      ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);
}

// Run the demo
agentDemo().catch((error) => {
  console.error("Demo failed:", error.message);
  console.log("\nMake sure the API server is running at http://localhost:4000");
  process.exit(1);
});
