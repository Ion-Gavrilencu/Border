const { del } = require("@vercel/blob");
const pool = require("../config/database");

// Call only from a trusted administrative job, never from a public route.
// Jobs in processing for > 15 minutes can be retried after an interrupted run.
async function processBlobCleanupQueue({ limit = 25 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const result = { processed: 0, deleted: 0, failed: 0, errors: [] };
  const handled = [];
  for (let i = 0; i < safeLimit; i += 1) {
    const client = await pool.connect();
    let job;
    try {
      await client.query("BEGIN");
      const selected = await client.query(
        `
        SELECT * FROM blob_cleanup_queue
        WHERE (status IN ('pending', 'error')
          OR (status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes'))
          AND NOT (id = ANY($1::bigint[]))
        ORDER BY id
        FOR UPDATE SKIP LOCKED LIMIT 1
      `,
        [handled],
      );
      if (!selected.rows.length) {
        await client.query("COMMIT");
        break;
      }
      job = selected.rows[0];
      await client.query(
        `UPDATE blob_cleanup_queue
        SET status='processing', attempts=attempts+1,
            last_error=NULL, updated_at=NOW() WHERE id=$1`,
        [job.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    handled.push(job.id);
    result.processed += 1;
    try {
      const match =
        /^attachments\/(telegrame|ordine|legislatie|informatii_utile|news)\/([1-9]\d*)\/[^/]+$/.exec(
          job.blob_path,
        );
      if (
        !match ||
        match[1] !== job.source_entity_type ||
        (job.source_entity_id != null &&
          match[2] !== String(job.source_entity_id))
      ) {
        throw new Error("Cale Blob sau entitate incompatibilă cu operațiunea");
      }
      // Never delete a blob still referenced by any live attachment.
      const referenced = await pool.query(
        "SELECT 1 FROM attachments WHERE file_path = $1 LIMIT 1",
        [`blob:${job.blob_path}`],
      );
      if (referenced.rows.length) {
        throw new Error(
          "Fișierul este încă referit de un atașament; ștergerea a fost blocată",
        );
      }
      await del(job.blob_path);
      await pool.query(
        `UPDATE blob_cleanup_queue SET status='done', processed_at=NOW(),
        last_error=NULL, updated_at=NOW() WHERE id=$1`,
        [job.id],
      );
      result.deleted += 1;
    } catch (error) {
      const message = String(error.message || error).slice(0, 1000);
      await pool.query(
        `UPDATE blob_cleanup_queue SET status='error',
        last_error=$2, updated_at=NOW() WHERE id=$1`,
        [job.id, message],
      );
      result.failed += 1;
      result.errors.push({ jobId: job.id, message });
    }
  }
  return result;
}

module.exports = { processBlobCleanupQueue };
