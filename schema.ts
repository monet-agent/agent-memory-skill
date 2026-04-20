/**
 * Checkpoint schema for agent-memory skill
 * Version 1.0.0
 */

export interface Checkpoint {
  version: number;
  timestamp: string;
  reason: string;
  agent_id: string;
  memory: MemoryState;
  metadata: CheckpointMetadata;
  signature: string;
}

export interface MemoryState {
  /** Current working context — what the agent was doing */
  working_context: string;
  /** Open commitments from COMMITMENTS.md */
  open_commitments: Commitment[];
  /** Recent learnings to preserve */
  recent_learnings: string[];
  /** Active relationships from RELATIONSHIPS.md */
  active_relationships: string[];
  /** Last heartbeat timestamp */
  last_heartbeat: string;
}

export interface Commitment {
  id: string;
  who: string;
  what: string;
  due: string;
  source: string;
}

export interface CheckpointMetadata {
  /** Size in bytes of serialized checkpoint */
  size_bytes: number;
  /** Number of previous checkpoints */
  checkpoint_number: number;
  /** Payment status for this checkpoint */
  payment: PaymentInfo;
}

export interface PaymentInfo {
  /** mock | usdc | stripe */
  method: string;
  /** Amount in smallest currency unit (cents for USD) */
  amount_cents: number;
  /** Transaction reference */
  tx_ref: string;
  /** Settled timestamp */
  settled_at: string | null;
}

/** Default empty state */
export const EMPTY_MEMORY: MemoryState = {
  working_context: "",
  open_commitments: [],
  recent_learnings: [],
  active_relationships: [],
  last_heartbeat: "",
};

/** Current schema version */
export const SCHEMA_VERSION = 1;

/** Checkpoint file extension */
export const CHECKPOINT_EXT = ".checkpoint.json";

/** Default checkpoint directory */
export const DEFAULT_CHECKPOINT_DIR = "/data/checkpoints";
