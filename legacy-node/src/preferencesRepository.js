/**
 * Repository abstraction for donor preferences.
 *
 * Production: UserServicePreferencesRepository (USER_SERVICE_BASE_URL).
 * Tests: LocalPreferencesRepository + PreferencesStore (temp file only).
 *
 * Contract:
 *   init() -> Promise<void>
 *   listByUser(userId, opts?) -> Promise<Preset[]>
 *   upsertForUser(userId, presets, opts?) -> Promise<Preset[]>
 *   clearForUser(userId, opts?) -> Promise<Preset[]>
 *   removePresetForUser(userId, key, opts?) -> Promise<Preset[]>
 */

export class LocalPreferencesRepository {
  constructor(store) {
    if (!store) {
      throw new Error("LocalPreferencesRepository requires a PreferencesStore");
    }
    this._store = store;
  }

  async init() {
    return this._store.init();
  }

  async listByUser(userId, _opts = {}) {
    return this._store.getByUser(userId);
  }

  async upsertForUser(userId, presets, _opts = {}) {
    return this._store.saveForUser(userId, presets);
  }

  async clearForUser(userId, _opts = {}) {
    return this._store.clearForUser(userId);
  }

  async removePresetForUser(userId, key, _opts = {}) {
    return this._store.removePresetForUser(userId, key);
  }
}

/**
 * Remote repository backed by sharingbridge-user-service.
 *
 * Expected user-service contract:
 *   GET    /v1/users/{user_id}/donor-presets              -> { presets: Preset[] }
 *   PUT    /v1/users/{user_id}/donor-presets              -> { presets: Preset[] }
 *   POST   /v1/users/{user_id}/donor-presets/delete-item  -> { presets: Preset[] }
 *          body: { restaurant_name, order_url }
 *
 * Auth: forward the donor's auth context (see "minimal auth context" task).
 */
export class UserServicePreferencesError extends Error {
  constructor({ status, code, message }) {
    super(message);
    this.name = "UserServicePreferencesError";
    this.status = status;
    this.code = code;
  }
}

export class UserServicePreferencesRepository {
  constructor({ baseUrl }) {
    if (!baseUrl) {
      throw new Error(
        "UserServicePreferencesRepository requires baseUrl (USER_SERVICE_BASE_URL)"
      );
    }
    this._baseUrl = baseUrl;
  }

  async init() {
    // No-op for MVP; calls are health-checked lazily per request.
  }

  async listByUser(userId, opts = {}) {
    const response = await fetch(
      `${this._baseUrl}/v1/users/${encodeURIComponent(userId)}/donor-presets`,
      { headers: this.#buildHeaders(opts.authHeaders) }
    );
    const payload = await this.#readJson(response);
    if (!response.ok) {
      throw this.#toError(response.status, payload);
    }
    if (!payload || !Array.isArray(payload.presets)) {
      throw new Error("User-service GET donor-presets returned invalid payload.");
    }
    return payload.presets;
  }

  async upsertForUser(userId, presets, opts = {}) {
    const response = await fetch(
      `${this._baseUrl}/v1/users/${encodeURIComponent(userId)}/donor-presets`,
      {
        method: "PUT",
        headers: this.#buildHeaders(opts.authHeaders, {
          "content-type": "application/json"
        }),
        body: JSON.stringify({ presets })
      }
    );
    const payload = await this.#readJson(response);
    if (!response.ok) {
      throw this.#toError(response.status, payload);
    }
    if (!payload || !Array.isArray(payload.presets)) {
      throw new Error("User-service PUT donor-presets returned invalid payload.");
    }
    return payload.presets;
  }

  async clearForUser(userId, opts = {}) {
    return this.upsertForUser(userId, [], opts);
  }

  async removePresetForUser(userId, key, opts = {}) {
    const response = await fetch(
      `${this._baseUrl}/v1/users/${encodeURIComponent(userId)}/donor-presets/delete-item`,
      {
        method: "POST",
        headers: this.#buildHeaders(opts.authHeaders, {
          "content-type": "application/json"
        }),
        body: JSON.stringify({
          restaurant_name: String(key.restaurant_name ?? "").trim(),
          order_url: String(key.order_url ?? "").trim()
        })
      }
    );
    const payload = await this.#readJson(response);
    if (!response.ok) {
      throw this.#toError(response.status, payload);
    }
    if (!payload || !Array.isArray(payload.presets)) {
      throw new Error(
        "User-service delete-item donor-presets returned invalid payload."
      );
    }
    return payload.presets;
  }

  #buildHeaders(authHeaders = {}, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (
      authHeaders.authorization &&
      typeof authHeaders.authorization === "string"
    ) {
      headers.authorization = authHeaders.authorization;
    }
    if (authHeaders["x-user-id"] && typeof authHeaders["x-user-id"] === "string") {
      headers["x-user-id"] = authHeaders["x-user-id"];
    }
    return headers;
  }

  async #readJson(response) {
    const text = await response.text();
    if (!text) {
      return {};
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `User-service response was not valid JSON (status ${response.status}).`
      );
    }
  }

  #toError(status, payload) {
    const code = payload?.code || "preferences_backend_error";
    const message =
      payload?.message || `User-service donor-presets request failed (HTTP ${status}).`;
    return new UserServicePreferencesError({ status, code, message });
  }
}
