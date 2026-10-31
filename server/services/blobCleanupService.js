"use strict";

const { del } = require("@vercel/blob");
const pool = require("../config/database");

// Validarea căilor fișierelor din Vercel Blob
const VALID_BLOB_PATH =
  /^attachments\/(telegrame|ordine|legislatie|informatii_utile|news)\/([1-9]\d*)\/[^/\\?#]+$/;

const RETRY_AFTER_MINUTES = 15;

function getSafeLimit(limit) {
  const value = Number(limit);
  if (!Number.isFinite(value)) return 25;
  return Math.min(100, Math.max(1, Math.trunc(value)));
}

function validateJob(job) {
  if (typeof job.blob_path !== "string") {
    throw new Error("Calea Blob lipsește sau nu este un șir de caractere.");
  }

  const match = VALID_BLOB_PATH.exec(job.blob_path);
  if (
    !match ||
    match[1] !== job.source_entity_type ||
    (job.source_entity_id != null && match[2] !== String(job.source_entity_id))
  ) {
    throw new Error("Cale Blob sau entitate incompatibilă cu operațiunea.");
  }
}

async function claimNextJob(handled) {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;
    const selected = await client.query(
      `SELECT * FROM blob_cleanup_queue
       WHERE (
         status IN ('pending', 'error')
         OR (status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes')
       )
       AND NOT (id = ANY($1::bigint[]))
       ORDER BY id
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      [handled],
    );

    if (!selected.rows.length) {
      await client.query("COMMIT");
      inTransaction = false;
      return null;
    }

    const job = selected.rows[0];
    await client.query(
      `UPDATE blob_cleanup_queue
       SET status = 'processing', attempts = attempts + 1,
           last_error = NULL, updated_at = NOW()
       WHERE id = $1`,
      [job.id],
    );
    await client.query("COMMIT");
    inTransaction = false;
    return job;
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error("BLOB CLEANUP ROLLBACK ERROR:", rollbackError);
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

async function markJobDone(job) {
  // Compare the claim timestamp indirectly via status and attempt number.
  // A newer worker must not have reclaimed this job while the previous worker runs.
  const updated = await pool.query(
    `UPDATE blob_cleanup_queue
     SET status = 'done', processed_at = NOW(), last_error = NULL, updated_at = NOW()
     WHERE id = $1 AND status = 'processing' AND attempts = $2`,
    [job.id, Number(job.attempts || 0) + 1],
  );
  if (updated.rowCount !== 1) {
    throw new Error("Operațiunea a fost preluată între timp de alt proces.");
  }
}

async function markJobError(job, message) {
  await pool.query(
    `UPDATE blob_cleanup_queue
     SET status = 'error', last_error = $3, updated_at = NOW()
     WHERE id = $1 AND status = 'processing' AND attempts = $2`,
    [job.id, Number(job.attempts || 0) + 1, message],
  );
}

async function processBlobCleanupQueue({ limit = 25 } = {}) {
  // Local development must never delete production Blob objects.
  if (process.env.NODE_ENV !== "production" || process.env.BLOB_CLEANUP_ENABLED !== "true") {
    return {
      processed: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      skipped: true,
      reason: "Curățarea Blob este permisă doar în producție, cu BLOB_CLEANUP_ENABLED=true.",
    };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN nu este configurat.");
  }

  const safeLimit = getSafeLimit(limit);
  const result = { processed: 0, deleted: 0, failed: 0, errors: [] };
  const handled = [];

  for (let i = 0; i < safeLimit; i += 1) {
    const job = await claimNextJob(handled);
    if (!job) break;

    handled.push(job.id);
    result.processed += 1;

    try {
      validateJob(job);

      // Don't delete a Blob that still has live attachment references.
      const referenced = await pool.query(
        "SELECT 1 FROM attachments WHERE file_path = $1 LIMIT 1",
        [`blob:${job.blob_path}`],
      );
      if (referenced.rows.length) {
        throw new Error("Fișierul este încă referit de un atașament; ștergerea a fost blocată.");
      }

      await del(job.blob_path, { token: process.env.BLOB_READ_WRITE_TOKEN });
      await markJobDone(job);
      result.deleted += 1;
    } catch (error) {
      const message = String(error?.message || error).slice(0, 1000);
      try {
        await markJobError(job, message);
      } catch (updateError) {
        console.error("BLOB CLEANUP STATUS UPDATE ERROR:", updateError);
      }
      result.failed += 1;
      result.errors.push({ jobId: job.id, message });
    }
  }

  return result;
}

module.exports = { processBlobCleanupQueue };
