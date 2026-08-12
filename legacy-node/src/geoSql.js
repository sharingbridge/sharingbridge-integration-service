const SCHEMA_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveGisSchema(env = process.env) {
  const raw = env.GIS_SCHEMA?.trim();
  if (!raw) {
    throw new Error(
      "GIS_SCHEMA is required — set the spatial extension schema to match database DDL (see configuration/environment-variables.md)."
    );
  }
  if (raw.length > 63 || !SCHEMA_NAME_RE.test(raw)) {
    throw new Error(
      `GIS_SCHEMA must be a valid SQL identifier (got ${JSON.stringify(raw)}).`
    );
  }
  return raw;
}

export const GIS_SCHEMA = resolveGisSchema();

/** @param {string} name */
export function gisFn(name) {
  return `${GIS_SCHEMA}.${name}`;
}

export function geographyType() {
  return `${GIS_SCHEMA}.geography`;
}

/** SQL fragment for INSERT/UPDATE location geography column. */
export function locationSqlFragment(lngParam, latParam) {
  const geo = geographyType();
  return `CASE
    WHEN ${lngParam}::double precision IS NOT NULL
     AND ${latParam}::double precision IS NOT NULL
    THEN ${gisFn("ST_SetSRID")}(${gisFn("ST_MakePoint")}(${lngParam}::double precision, ${latParam}::double precision), 4326)::${geo}
    ELSE NULL
  END`;
}

export function gisPointFromParams(lngParam, latParam) {
  const geo = geographyType();
  return `${gisFn("ST_SetSRID")}(${gisFn("ST_MakePoint")}(${lngParam}, ${latParam}), 4326)::${geo}`;
}
