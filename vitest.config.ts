import { defineConfig } from "vitest/config";

// Only run the app's own unit tests under src/. (The ClaudeKit kit under .claude/
// ships its own .cjs tests with a separate runner — keep them out of our suite.)
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.ts"],
  },
});
