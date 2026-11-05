export async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 25000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function safeFetchJson(url, options = {}, defaultValue = []) {
  try {
    const res = await fetch(url, options);
    if (!res || !res.ok) return defaultValue;
    const text = await res.text();
    if (!text || !text.trim()) return defaultValue;
    return JSON.parse(text);
  } catch (_) {
    return defaultValue;
  }
}

