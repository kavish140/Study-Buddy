function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  if (typeof data.error === "string") return data.error;
  if (
    data.error &&
    typeof data.error === "object" &&
    "message" in data.error &&
    typeof data.error.message === "string"
  )
    return data.error.message;
  return typeof data.message === "string" ? data.message : fallback;
}

export async function readAIJson<T>(response: Response): Promise<T> {
  const fallback =
    response.status === 401
      ? "Your session expired. Please sign in again."
      : response.status === 429
        ? "AI usage limit reached. Please wait a moment and try again."
        : "The AI service could not complete this request. Please try again.";
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok || payload?.error) throw new Error(errorMessage(payload, fallback));
  if (!payload || typeof payload !== "object")
    throw new Error("The AI service returned an empty response.");
  return payload as T;
}

/** Parse complete SSE records, including errors and a final record without a newline. */
export async function consumeChatStream(response: Response, onChunk: (text: string) => void) {
  if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
    await readAIJson(response);
    throw new Error("The chat service returned an unexpected response. Please try again.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The chat service returned no response.");
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedText = false;
  let completed = false;
  const processLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data) return;
    if (data === "[DONE]") {
      completed = true;
      return;
    }
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      throw new Error("The chat response was interrupted. Please try again.");
    }
    if (event.error)
      throw new Error(errorMessage(event, "The chat service failed. Please try again."));
    const choice = event.choices?.[0];
    if (choice?.finish_reason === "length")
      throw new Error("The response reached its length limit. Please ask a shorter question.");
    if (choice?.finish_reason && choice.finish_reason !== "stop")
      throw new Error("The chat service could not finish this response. Please try again.");
    const text = choice?.delta?.content;
    if (typeof text === "string" && text) {
      receivedText = true;
      onChunk(text);
    }
  };
  try {
    while (!completed) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line.trim());
        if (completed) break;
      }
      if (done) {
        if (buffer.trim() && !completed) processLine(buffer.trim());
        break;
      }
    }
    if (!receivedText) throw new Error("The AI returned an empty response. Please try again.");
    if (!completed)
      throw new Error("The response was interrupted before it finished. Please try again.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
