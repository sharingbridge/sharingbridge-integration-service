/**
 * Resolve donor emails for coordinator dashboard (shared Postgres `users` table).
 */

export async function lookupDonorEmailsByUserId(pool, userIds) {
  if (!pool || !Array.isArray(userIds) || userIds.length === 0) {
    return {};
  }
  const unique = [
    ...new Set(
      userIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0)
    )
  ];
  if (unique.length === 0) {
    return {};
  }
  const result = await pool.query(
    `SELECT id, email FROM users WHERE id = ANY($1::text[])`,
    [unique]
  );
  const map = {};
  for (const row of result.rows) {
    const email =
      typeof row.email === "string" && row.email.trim() ? row.email.trim() : null;
    if (email) {
      map[row.id] = email;
    }
  }
  return map;
}
