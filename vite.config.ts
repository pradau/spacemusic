import { defineConfig } from "vite";

export default defineConfig({
  base:
    process.env.GITHUB_REPOSITORY != null
      ? "/" + process.env.GITHUB_REPOSITORY.split("/")[1] + "/"
      : "/",
});
