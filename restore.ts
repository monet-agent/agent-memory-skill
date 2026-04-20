/**
 * Checkpoint restoration logic for agent-memory skill
 * Hydrates agent state from disk on startup
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  Checkpoint,
  MemoryState,
  CHECKPOINT_EXT,
  DEFAULT_CHECKPOINT_DIR,
  EMPTY_MEMORY,
} from "./schema";
import { verifyCheckpoint } from "./checkpoint";

interface RestoreOptions {
  checkpointDir?: string;
  checkpointNumber?: number; // If not specified, uses latest
}

interface RestoreResult {
  success: boolean;
  checkpoint?: Checkpoint;
  memory?: MemoryState;
  message: string;
}

/**
 * Restore agent state from the latest (or specified) checkpoint
 */
export async function restoreCheckpoint(
  options: RestoreOptions = {}
): Promise<RestoreResult> {
  const checkpointDir = options.checkpointDir || DEFAULT_CHECKPOINT_DIR;
  
  try {
    // Find checkpoint file
    let checkpointFile: string;
    
    if (options.checkpointNumber) {
      const filename = `checkpoint-${options.checkpointNumber.toString().padStart(6, "0")}${CHECKPOINT_EXT}`;
      checkpointFile = path.join(checkpointDir, filename);
    } else {
      // Find latest checkpoint
      checkpointFile = await findLatestCheckpoint(checkpointDir);
    }
    
    if (!checkpointFile) {
      return {
        success: false,
        message: "No checkpoints found — starting fresh",
      };
    }
    
    // Read and parse checkpoint
    const content = await fs.readFile(checkpointFile, "utf-8");
    const checkpoint: Checkpoint = JSON.parse(content);
    
    // Verify integrity
    if (!verifyCheckpoint(checkpoint)) {
      return {
        success: false,
        message: `Checkpoint integrity check failed: ${checkpointFile}`,
      };
    }
    
    // Validate version
    if (checkpoint.version !== 1) {
      return {
        success: false,
        message: `Unsupported checkpoint version: ${checkpoint.version}`,
      };
    }
    
    console.log(`Restored from checkpoint #${checkpoint.metadata.checkpoint_number}`);
    console.log(`  Created: ${checkpoint.timestamp}`);
    console.log(`  Reason: ${checkpoint.reason}`);
    console.log(`  Working context: ${checkpoint.memory.working_context || "(none)"}`);
    console.log(`  Open commitments: ${checkpoint.memory.open_commitments.length}`);
    
    return {
      success: true,
      checkpoint,
      memory: checkpoint.memory,
      message: `Restored checkpoint #${checkpoint.metadata.checkpoint_number} from ${checkpoint.timestamp}`,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Restore failed: ${errorMessage}`,
    };
  }
}

/**
 * Find the latest checkpoint file in the directory
 */
async function findLatestCheckpoint(checkpointDir: string): Promise<string | null> {
  try {
    const files = await fs.readdir(checkpointDir);
    const checkpoints = files
      .filter(f => f.endsWith(CHECKPOINT_EXT))
      .sort(); // Alphabetic sort works due to zero-padding
    
    if (checkpoints.length === 0) {
      return null;
    }
    
    return path.join(checkpointDir, checkpoints[checkpoints.length - 1]);
  } catch {
    return null;
  }
}

/**
 * List all available checkpoints
 */
export async function listCheckpoints(
  checkpointDir: string = DEFAULT_CHECKPOINT_DIR
): Promise<Array<{ number: number; timestamp: string; reason: string }>> {
  try {
    const files = await fs.readdir(checkpointDir);
    const checkpoints = await Promise.all(
      files
        .filter(f => f.endsWith(CHECKPOINT_EXT))
        .map(async f => {
          const filepath = path.join(checkpointDir, f);
          const content = await fs.readFile(filepath, "utf-8");
          const cp: Checkpoint = JSON.parse(content);
          return {
            number: cp.metadata.checkpoint_number,
            timestamp: cp.timestamp,
            reason: cp.reason,
          };
        })
    );
    return checkpoints.sort((a, b) => a.number - b.number);
  } catch {
    return [];
  }
}

// CLI entry point
if (require.main === module) {
  const checkpointNum = process.argv[2] ? parseInt(process.argv[2]) : undefined;
  
  restoreCheckpoint({ checkpointNumber: checkpointNum })
    .then(result => {
      console.log(result.message);
      if (result.success) {
        // Output memory state as JSON for shell parsing
        console.log("\n---MEMORY---");
        console.log(JSON.stringify(result.memory, null, 2));
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error("Restore error:", err);
      process.exit(1);
    });
}
