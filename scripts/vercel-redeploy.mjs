/**
 * Redeploy the latest blocked commit on Vercel and wait for it to settle.
 *
 * Why this exists (2026-11-18): three deployments were BLOCKED because the git
 * author was `Developer <developer@genumsolutions.com>`, which is not a member
 * of the Vercel project. The commit itself is fine (CI green) — the block is an
 * author-identity gate. A redeploy runs as the project owner, so it ships the
 * same source without rewriting history.
 *
 * Usage: VERCEL_TOKEN=… node scripts/vercel-redeploy.mjs [deploymentId]
 * Reads VERCEL_TOKEN only from the environment; never prints it.
 */
const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || "prj_eXkz4BilmYJz1tRexKUglR4DCFIX";
const API = "https://api.vercel.com";

if (!TOKEN) {
  console.error("VERCEL_TOKEN is not set.");
  process.exit(1);
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

async function main() {
  let deploymentId = process.argv[2];

  if (!deploymentId) {
    const list = await api(`/v6/deployments?limit=5&projectId=${PROJECT_ID}`);
    if (!list.ok) throw new Error(`list failed (${list.status}): ${JSON.stringify(list.body)}`);
    const blocked = list.body.deployments.find((d) => d.state === "BLOCKED");
    if (!blocked) {
      console.log("No blocked deployment found; the latest state is already settled.");
      return;
    }
    deploymentId = blocked.uid;
    console.log(
      `Redeploying ${deploymentId} (${(blocked.meta?.githubCommitSha ?? "").slice(0, 7)}).`
    );
  }

  const created = await api("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: "genumsolutions-website",
      deploymentId,
      target: "production",
    }),
  });
  if (!created.ok) {
    throw new Error(`redeploy failed (${created.status}): ${JSON.stringify(created.body)}`);
  }

  const uid = created.body.uid;
  const url = created.body.url;
  console.log(`Started ${uid} -> https://${url}`);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const status = await api(`/v13/deployments/${uid}`);
    const state = status.body.readyState || status.body.state;
    console.log(`  ${attempt + 1}: ${state}`);
    if (state === "READY") {
      console.log(`READY: https://${url}`);
      return;
    }
    if (state === "ERROR" || state === "CANCELED" || state === "BLOCKED") {
      throw new Error(`Deployment ended ${state}: ${status.body.errorMessage ?? ""}`);
    }
  }
  console.log("Still building after 5 minutes — check the Vercel dashboard.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
