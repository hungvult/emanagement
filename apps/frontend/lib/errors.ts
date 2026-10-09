export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = error.response;
    if (response && typeof response === "object" && "data" in response) {
      const data = response.data;
      if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
      )
        return data.message;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
