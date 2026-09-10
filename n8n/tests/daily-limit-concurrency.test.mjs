import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { afterEach, test } from "node:test";

const workflowPath = new URL("../workflows/email-intake-ai-analysis.json", import.meta.url);
const servers = new Set();
afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  )));
  servers.clear();
});

const targets = (workflow, source, output = 0) =>
  (workflow.connections[source]?.main?.[output] ?? []).map(({ node }) => node);

async function mockFirebase(options = {}) {
  let count = options.initialCount ?? null;
  let version = count === null ? null : 0;
  const stats = { conflicts: 0, gets: 0, puts: 0 };
  const etag = () => version === null ? "null_etag" : `\"${version}\"`;
  const server = http.createServer(async (request, response) => {
    if (request.method === "GET") {
      stats.gets += 1;
      if (options.failGetStatus) {
        response.writeHead(options.failGetStatus);
        response.end(JSON.stringify({ error: "GET failure" }));
        return;
      }
      response.setHeader("etag", etag());
      response.setHeader("content-type", "application/json");
      response.writeHead(200);
      response.end(options.invalidBody ? JSON.stringify({ invalid: true }) : JSON.stringify(count));
      return;
    }
    if (request.method === "PUT") {
      stats.puts += 1;
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      if (options.failPutStatus) {
        response.writeHead(options.failPutStatus);
        response.end(JSON.stringify({ error: "PUT failure" }));
        return;
      }
      if (options.alwaysConflict || request.headers["if-match"] !== etag()) {
        stats.conflicts += 1;
        response.setHeader("etag", etag());
        response.writeHead(412);
        response.end(JSON.stringify({ error: "ETag mismatch" }));
        return;
      }
      count = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      version = (version ?? 0) + 1;
      response.setHeader("etag", etag());
      response.setHeader("content-type", "application/json");
      response.writeHead(200);
      response.end(JSON.stringify(count));
      return;
    }
    response.writeHead(405);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.add(server);
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/automationUsage/test/count.json`,
    stats,
    get count() { return count; },
  };
}

async function reserveSlot(url, options = {}) {
  const maxRetries = options.maxRetries ?? 20;
  try {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const read = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
      const body = await read.json();
      const etag = read.headers.get("etag");
      const valid = read.status === 200 && typeof etag === "string" && etag.length > 0 &&
        (body === null || (typeof body === "number" && Number.isInteger(body) && body >= 0));
      if (!valid) return { outcome: "systemFailure", attempt };
      const used = Number(body ?? 0);
      if (used >= 10) return { outcome: "limit", attempt };
      if (attempt === 0 && options.beforeFirstPut) await options.beforeFirstPut();
      const write = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json", "if-match": etag },
        body: JSON.stringify(used + 1),
      });
      if (write.status === 200) return { outcome: "reserved", attempt };
      if (write.status !== 412) return { outcome: "systemFailure", attempt };
    }
  } catch {
    return { outcome: "systemFailure", attempt: null };
  }
  return { outcome: "systemFailure", attempt: maxRetries };
}

function barrier(size) {
  let arrivals = 0;
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  return async () => {
    arrivals += 1;
    if (arrivals === size) release();
    await ready;
  };
}

test("workflow has a bounded ETag reservation before AI", async () => {
  const workflow = JSON.parse(await readFile(workflowPath, "utf8"));
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  const getUsage = nodes.get("Get Daily Usage");
  const reserve = nodes.get("Reserve Daily AI Slot");
  assert.equal(workflow.settings.timezone, "Europe/Berlin");
  assert.match(nodes.get("Edit Fields").parameters.assignments.assignments
    .find(({ name }) => name === "usageDate").value, /Europe\/Berlin/);
  assert.match(getUsage.parameters.url, /usageDate.*count\.json/);
  assert.deepEqual(getUsage.parameters.headerParameters.parameters,
    [{ name: "X-Firebase-ETag", value: "true" }]);
  assert.equal(getUsage.parameters.options.response.response.fullResponse, true);
  assert.equal(getUsage.parameters.options.response.response.neverError, true);
  assert.equal(reserve.parameters.method, "PUT");
  assert.match(reserve.parameters.url, /usageDate.*count\.json/);
  assert.equal(reserve.parameters.headerParameters.parameters[0].name, "if-match");
  assert.equal(reserve.parameters.options.response.response.neverError, true);
  assert.equal(nodes.get("Retry Available?").parameters.conditions.conditions[0].rightValue, 20);
  assert.deepEqual(targets(workflow, "Under Daily Limit?", 0), ["Reserve Daily AI Slot"]);
  assert.deepEqual(targets(workflow, "Reservation Succeeded?", 0), ["Information Extractor"]);
  assert.deepEqual(targets(workflow, "Reservation Conflict?", 0), ["Retry Available?"]);
  assert.deepEqual(targets(workflow, "Reservation Conflict?", 1), ["Send Usage Lookup Failure Email"]);
  assert.deepEqual(targets(workflow, "Retry Available?", 1), ["Send Usage Lookup Failure Email"]);
  assert.deepEqual(targets(workflow, "Under Daily Limit?", 1), ["Send Daily Limit Email"]);
  assert.deepEqual(targets(workflow, "Information Extractor", 1), ["Send Failure Email"]);
  assert.deepEqual(targets(workflow, "Task created?", 1), ["Send Failure Email"]);
  assert.deepEqual(targets(workflow, "Send an Email"), ["Destination Mailbox → erledigt"]);
  assert.deepEqual(targets(workflow, "Send Failure Email"), ["Move Email to zu bearbeiten"]);
  assert.deepEqual(targets(workflow, "Send Daily Limit Email"), ["Move Limit Email to zu bearbeiten"]);
  assert.match(nodes.get("Increment Tickets Created").parameters.url,
    /Normalize Daily Usage.*usageDate/);
});

test("15 parallel attempts reserve exactly 10 slots", async () => {
  const firebase = await mockFirebase();
  const synchronize = barrier(15);
  let mockAi = 0;
  let mockTasks = 0;
  const results = await Promise.all(Array.from({ length: 15 }, async () => {
    const result = await reserveSlot(firebase.url, { beforeFirstPut: synchronize });
    if (result.outcome === "reserved") {
      mockAi += 1;
      mockTasks += 1;
    }
    return result;
  }));
  const outcomes = results.map(({ outcome }) => outcome);
  assert.equal(outcomes.filter((value) => value === "reserved").length, 10);
  assert.equal(outcomes.filter((value) => value === "limit").length, 5);
  assert.equal(outcomes.filter((value) => value === "systemFailure").length, 0);
  assert.equal(firebase.count, 10);
  assert.equal(mockAi, 10);
  assert.equal(mockTasks, 10);
  assert.ok(firebase.stats.conflicts > 0);
});

test("sequential attempt 11 is rejected", async () => {
  const firebase = await mockFirebase();
  const results = [];
  for (let index = 0; index < 11; index += 1) results.push(await reserveSlot(firebase.url));
  assert.equal(results.filter(({ outcome }) => outcome === "reserved").length, 10);
  assert.equal(results.at(-1).outcome, "limit");
  assert.equal(firebase.count, 10);
});

test("unexpected responses use the system-failure path", async () => {
  const getFailure = await mockFirebase({ failGetStatus: 401 });
  const putFailure = await mockFirebase({ failPutStatus: 503 });
  const invalid = await mockFirebase({ invalidBody: true });
  assert.equal((await reserveSlot(getFailure.url)).outcome, "systemFailure");
  assert.equal((await reserveSlot(putFailure.url)).outcome, "systemFailure");
  assert.equal((await reserveSlot(invalid.url)).outcome, "systemFailure");
});

test("repeated 412 conflicts terminate", async () => {
  const firebase = await mockFirebase({ alwaysConflict: true });
  const result = await reserveSlot(firebase.url, { maxRetries: 2 });
  assert.equal(result.outcome, "systemFailure");
  assert.equal(firebase.stats.puts, 3);
  assert.equal(firebase.count, null);
});
