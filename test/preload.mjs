/**
 * Test harness: set GIS_SCHEMA before geoSql.js loads in test files.
 * Production and scripts must set GIS_SCHEMA explicitly (see env.example).
 */
if (!process.env.GIS_SCHEMA?.trim()) {
  process.env.GIS_SCHEMA = "extensions";
}
