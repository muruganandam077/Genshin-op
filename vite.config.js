import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = dirname(fileURLToPath(import.meta.url));

function readCatalogCounts() {
  const characters = JSON.parse(
    readFileSync(resolve(projectRoot, "characters", "index.json"), "utf8"),
  );
  const artifacts = JSON.parse(
    readFileSync(resolve(projectRoot, "all_artifacts.json"), "utf8"),
  );
  const weapons = readdirSync(resolve(projectRoot, "weapons"))
    .filter((filename) => filename.endsWith(".json"));
  return {
    characters: characters.length,
    weapons: weapons.length,
    artifacts: artifacts.length,
  };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "catalog-public-data",
      configureServer(server) {
        server.middlewares.use("/catalog-index.json", (_request, response) => {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(readCatalogCounts()));
        });
        server.middlewares.use("/weapons/index.json", (_request, response) => {
          const filenames = readdirSync(resolve(projectRoot, "weapons"))
            .filter((filename) => filename.endsWith(".json"))
            .sort((a, b) => a.localeCompare(b));
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(filenames));
        });
      },
      closeBundle() {
        const outputDirectory = resolve(projectRoot, "dist");
        mkdirSync(outputDirectory, { recursive: true });
        writeFileSync(
          resolve(outputDirectory, "catalog-index.json"),
          JSON.stringify(readCatalogCounts()),
        );
        for (const directory of ["characters", "weapons"]) {
          cpSync(
            resolve(projectRoot, directory),
            resolve(outputDirectory, directory),
            { recursive: true },
          );
        }
        writeFileSync(
          resolve(outputDirectory, "weapons", "index.json"),
          JSON.stringify(
            readdirSync(resolve(projectRoot, "weapons"))
              .filter((filename) => filename.endsWith(".json"))
              .sort((a, b) => a.localeCompare(b)),
          ),
        );
        cpSync(
          resolve(projectRoot, "all_artifacts.json"),
          resolve(outputDirectory, "all_artifacts.json"),
        );
        for (const directory of ["char", "weapons", "artifact_images"]) {
          cpSync(
            resolve(projectRoot, "assets", directory),
            resolve(outputDirectory, "assets", directory),
            { recursive: true },
          );
        }
      },
    },
  ],
});
