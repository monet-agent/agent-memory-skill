/**
 * Checkpoint creation logic for agent-memory skill
 * Captures agent state and persists to disk
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createHash } from "crypto";
import {
  Checkpoint,
  MemoryState,
  CheckpointMetadata,
  PaymentInfo,
  SCHEMA_VERSION,
  CHECKPOINT_EXT,
  DEFAULT_CHECKPOINT_DIR,
  EMPTY_MEMORY,
} from "./schema";

interface CheckpointOptions {
  reason: string;
  agentId: string;
  checkpointDir?: string;
  memoryState?: Partial<MemoryState>;
  paymentMethod?: "mock" | "usdc";
}

/**
 * Create a new checkpoint from current agent state
 */
export async function createCheckpoint(
  options: CheckpointOptions
): Promise<Checkpoint> {
  const checkpointDir = options.checkpointDir || DEFAULT_CHECKPOINT_DIR;
  
  // Ensure checkpoint directory exists
  await fs.mkdir(checkpointDir, { recursive: true });
  
  // Get checkpoint number (count existing checkpoints)
  const checkpointNumber = await getNextCheckpointNumber(checkpointDir);
  
  // Build memory state from provided partials or defaults
  const memory: MemoryState = {
    ...EMPTY_MEMORY,
    ...options.memoryState,
    last_heartbeat: new Date().toISOString(),
  };
  
  // Mock payment info (Tier 0-1)
  const payment: PaymentInfo = {
    method: options.paymentMethod || "mock",
    amount_cents: 2, // $0.02
    tx_ref: `mock-${Date.now()}`,
    settled_at: options.paymentMethod === "usdc" ? null : new Date().toISOString(),
  };
  
  // Build checkpoint object
  const checkpoint: Checkpoint = {
    version: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    reason: options.reason,
    agent_id: options.agentId,
    memory,
    metadata: {
      size_bytes: 0, // Will be set after serialization
      checkpoint_number: checkpointNumber,
      payment,
    },
    signature: "", // Will be computed
  };
  
  // Serialize and compute size
  const serialized = JSON.stringify(checkpoint, null, 2);
  checkpoint.metadata.size_bytes = Buffer.byteLength(serialized, "utf-8");
  
  // Compute signature (hash of content without signature field)
  checkpoint.signature = computeSignature(checkpoint);
  
  // Write to disk
  const filename = `checkpoint-${checkpointNumber.toString().padStart(6, "0")}${CHECKPOINT_EXT}`;
  const filepath = path.join(checkpointDir, filename);
  await fs.writeFile(filepath, JSON.stringify(checkpoint, null, 2), "utf-8");
  
  console.log(`Checkpoint created: ${filepath}`);
  console.log(`  Size: ${checkpoint.metadata.size_bytes} bytes`);
  console.log(`  Payment: ${payment.amount_cents}c via ${payment.method}`);
  
  return checkpoint;
}

/**
 * Get the next checkpoint number based on existing files
 */
async function getNextCheckpointNumber(checkpointDir: string): Promise<number> {
  try {
    const files = await fs.readdir(checkpointDir);
    const checkpoints = files.filter(f => f.endsWith(CHECKPOINT_EXT));
    return checkpoints.length + 1;
  } catch {
    return 1;
  }
}

/**
 * Compute SHA-256 signature of checkpoint content
 */
function computeSignature(checkpoint: Checkpoint): string {
  // Create a copy without the signature field
  const { signature, ...content } = checkpoint;
  const serialized = JSON.stringify(content, Object.keys(content).sort());
  const hash = createHash("sha256").update(serialized).digest("hex");
  return `sha256:${hash}`;
}

/**
 * Verify checkpoint integrity
 */
export function verifyCheckpoint(checkpoint: Checkpoint): boolean {
  const computed = computeSignature(checkpoint);
  return computed === checkpoint.signature;
}

// CLI entry point
if (require.main === module) {
  const reason = process.argv[2] || "manual";
  const agentId = process.env.AGENT_ID || "agent-unknown";
  
  createCheckpoint({
    reason,
    agentId,
    memoryState: {
      working_context: process.env.WORKING_CONTEXT || "",
    },
  }).then(cp => {
    console.log("Checkpoint complete:", cp.timestamp);
    process.exit(0);
  }).catch(err => {
    console.error("Checkpoint failed:", err);
    process.exit(1);
  });
}
