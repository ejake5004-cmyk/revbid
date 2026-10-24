// Starts RevBid locally: `npm start`, then open http://localhost:3000
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { seed, DEMO_PASSWORD } from "./seed.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.REVBID_DATA ?? join(root, "data");
const port = Number(process.env.PORT ?? 3000);

const app = createApp({ dbFile: join(dataDir, "revbid.db"), uploadsDir: join(dataDir, "uploads") });
if (seed(app.db))
  console.log(
    `Added demo data. Demo accounts use the password "${DEMO_PASSWORD}"` +
      (process.env.ADMIN_PASSWORD ? " (admin uses ADMIN_PASSWORD)." : " (try admin or ivy_m3)."),
  );

app.server.listen(port, () => console.log(`RevBid is running at http://localhost:${port}`));
process.on("SIGINT", () => {
  app.stop();
  process.exit(0);
});
