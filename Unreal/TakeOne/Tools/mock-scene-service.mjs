import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const port = Number.parseInt(process.env.TAKEONE_SCENE_SERVICE_PORT ?? "8787", 10);
const expectedToken = process.env.TAKEONE_SCENE_SERVICE_TOKEN ?? "";
const maxBodyBytes = 64 * 1024;

function send(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function tokenMatches(header) {
  if (!expectedToken) {
    return true;
  }

  const received = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBytes = Buffer.from(expectedToken);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length
    && timingSafeEqual(expectedBytes, receivedBytes);
}

function color(seed, offset) {
  const bytes = createHash("sha256").update(`${seed}:${offset}`).digest();
  const channel = index => (55 + bytes[index] % 130).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`.toUpperCase();
}

function sceneFor(prompt) {
  const normalized = prompt.toLowerCase();
  const title = normalized.includes("station") || normalized.includes("train")
    ? "Generated Night Platform"
    : normalized.includes("forest")
      ? "Generated Forest Clearing"
      : normalized.includes("city") || normalized.includes("alley")
        ? "Generated City Backlot"
        : "Generated Director Stage";

  const objects = [
    {
      id: "hero_floor",
      label: "Hero performance area",
      primitive: "cube",
      location: { x: 100, y: 0, z: 20 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
      scale: { x: 18, y: 11, z: 0.4 },
      color: color(prompt, 0),
      cast_shadow: true,
      asset_hint: `original hero set piece for: ${prompt}`.slice(0, 300)
    },
    {
      id: "background_mass",
      label: "Background architecture",
      primitive: "cube",
      location: { x: 900, y: 0, z: 600 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
      scale: { x: 1, y: 22, z: 12 },
      color: color(prompt, 1),
      cast_shadow: true,
      asset_hint: `background architecture for: ${prompt}`.slice(0, 300)
    }
  ];

  for (let index = 0; index < 10; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    objects.push({
      id: `set_dressing_${index}`,
      label: `Set dressing ${index + 1}`,
      primitive: index % 3 === 0 ? "cylinder" : index % 3 === 1 ? "cube" : "cone",
      location: {
        x: -850 + index * 210,
        y: side * (550 + (index % 4) * 120),
        z: 100 + (index % 3) * 75
      },
      rotation: { pitch: 0, yaw: index * 17, roll: 0 },
      scale: {
        x: 0.8 + (index % 3) * 0.4,
        y: 0.8 + ((index + 1) % 3) * 0.4,
        z: 2 + (index % 4)
      },
      color: color(prompt, index + 2),
      cast_shadow: true,
      asset_hint: `set-dressing variation ${index + 1} for: ${prompt}`.slice(0, 300)
    });
  }

  return {
    schema_version: "1.0",
    title,
    summary: `Editable proxy layout generated from the director's prompt: ${prompt}`.slice(0, 500),
    environment: {
      ground_color: "#090B0D",
      sky_light_color: "#49617A",
      sky_light_intensity: 0.85,
      sun_color: "#FFD4AD",
      sun_intensity: 5.5,
      sun_rotation: { pitch: -36, yaw: -32, roll: 0 },
      fog_density: normalized.includes("fog") ? 0.034 : 0.012
    },
    camera: {
      location: { x: -1700, y: -1100, z: 560 },
      rotation: { pitch: -11, yaw: 33, roll: 0 },
      fov: 50
    },
    objects
  };
}

function validateRequest(body) {
  if (body?.schema_version !== "1.0") {
    return "schema_version must be '1.0'.";
  }
  if (typeof body?.prompt !== "string" || body.prompt.trim().length < 3) {
    return "prompt must be a string with at least three characters.";
  }
  return "";
}

if (process.argv.includes("--check")) {
  const sample = sceneFor("An abandoned railway station at night with heavy fog.");
  if (sample.schema_version !== "1.0" || sample.objects.length < 1) {
    throw new Error("Mock scene self-check failed.");
  }
  console.log(`Mock scene self-check passed (${sample.objects.length} objects).`);
  process.exit(0);
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    send(response, 200, { ok: true, schema_version: "1.0" });
    return;
  }

  if (request.method !== "POST" || request.url !== "/v1/scenes/generate") {
    send(response, 404, { error: "Not found." });
    return;
  }

  if (!tokenMatches(request.headers.authorization)) {
    send(response, 401, { error: "Unauthorized." });
    return;
  }

  const chunks = [];
  let receivedBytes = 0;
  request.on("data", chunk => {
    receivedBytes += chunk.length;
    if (receivedBytes > maxBodyBytes) {
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });

  request.on("end", () => {
    if (receivedBytes > maxBodyBytes) {
      send(response, 413, { error: "Request body is too large." });
      return;
    }

    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      send(response, 400, { error: "Request body must be valid JSON." });
      return;
    }

    const error = validateRequest(body);
    if (error) {
      send(response, 400, { error });
      return;
    }

    send(response, 200, sceneFor(body.prompt.trim().slice(0, 4000)));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Take One mock scene service listening on http://127.0.0.1:${port}`);
});
