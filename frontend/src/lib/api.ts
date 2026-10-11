import type {
  Bootstrap,
  Scenario,
  SavedScenario,
  ScenarioResult,
} from "./types";

async function request<T>(
  route: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${route}`, {
    signal,
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : `Request failed (${response.status}). Check that the Python API is running on port 8000.`,
    );
  }
  return response.json() as Promise<T>;
}
export const api = {
  bootstrap: (signal: AbortSignal) => request<Bootstrap>("bootstrap", signal),
  scenario: (
    current: Scenario,
    baseline: SavedScenario | null,
    signal: AbortSignal,
  ) => request<ScenarioResult>("scenario", signal, { current, baseline }),
};
