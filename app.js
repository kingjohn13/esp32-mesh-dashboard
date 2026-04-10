// ==== CONFIG: HIVEMQ CLOUD ====
const MQTT_WS_URL =
  'wss://63a94dada2fa46b797e4d6fdf720f43f.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USERNAME = 'JuneJuly';
const MQTT_PASSWORD = 'JuneJuly1';
const MQTT_TOPIC = 'esp32/mesh/debug';

// ==== State ====
const state = {
  temp: null,
  hum: null,
  dist: null,
  nodeId: null,
  role: null,
  nodes: 0,
  neighbors: []
};

let sampleCounter = 0;

// ==== Helpers ====
function clampTo60(v) {
  return Math.max(0, Math.min(60, v ?? 0));
}
function clampTo100(v) {
  return Math.max(0, Math.min(100, v ?? 0));
}

// ==== Chart Options ====
const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  layout: {
    padding: { left: 8, right: 8, top: 6, bottom: 6 }
  },
  plugins: { legend: { display: false } },
  scales: {
    x: {
      offset: true,
      ticks: {
        padding: 4,
        color: "rgba(197,198,199,0.6)",
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 4,
        font: { size: 8 }
      },
      grid: {
        color: "rgba(255,255,255,0.04)",
        drawBorder: false
      }
    },
    y: {
      ticks: {
        padding: 4,
        color: "rgba(197,198,199,0.7)",
        font: { size: 8 }
      },
      grid: {
        color: "rgba(255,255,255,0.04)",
        drawBorder: false
      }
    }
  }
};

const options0to60 = {
  ...baseOptions,
  scales: {
    ...baseOptions.scales,
    y: {
      ...baseOptions.scales.y,
      min: 0,
      max: 60,
      ticks: { ...baseOptions.scales.y.ticks, stepSize: 10 }
    }
  }
};

const options0to100 = {
  ...baseOptions,
  scales: {
    ...baseOptions.scales,
    y: {
      ...baseOptions.scales.y,
      min: 0,
      max: 100,
      ticks: { ...baseOptions.scales.y.ticks, stepSize: 20 }
    }
  }
};

// ==== START AFTER DOM ====
window.addEventListener("DOMContentLoaded", () => {
  // DOM refs
  const tempSpan = document.getElementById("temp-value");
  const humSpan = document.getElementById("hum-value");
  const distSpan = document.getElementById("dist-value");
  const nodeIdSpan = document.getElementById("node-id");
  const roleSpan = document.getElementById("node-role");
  const nodeCountSpan = document.getElementById("node-count");
  const neighborsSpan = document.getElementById("neighbors");
  const connStatus = document.getElementById("conn-status");
  const lastUpdateSpan = document.getElementById("last-update");
  const eventLog = document.getElementById("event-log");

  // ==== Charts ====
  const createChart = (ctx, label, color, bg, options) =>
    new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label,
          data: [],
          borderColor: color,
          backgroundColor: bg,
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true,
          clip: false
        }]
      },
      options
    });

  const tempChart = createChart(
    document.getElementById("temp-chart"),
    "Temp",
    "#ff6b6b",
    "rgba(255,107,107,0.2)",
    options0to60
  );

  const humChart = createChart(
    document.getElementById("hum-chart"),
    "Humidity",
    "#1e90ff",
    "rgba(30,144,255,0.2)",
    options0to100
  );

  const distChart = createChart(
    document.getElementById("dist-chart"),
    "Distance",
    "#f2c94c",
    "rgba(242,201,76,0.2)",
    options0to60
  );

  function pushToCharts(temp, hum, dist) {
    const t = new Date().toLocaleTimeString();
    const MAX = 10;

    const update = (chart, value) => {
      if (value == null) return;
      chart.data.labels.push(t);
      chart.data.datasets[0].data.push(value);
      while (chart.data.labels.length > MAX) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.update('none');
    };

    update(tempChart, clampTo60(temp));
    update(humChart, clampTo100(hum));
    update(distChart, clampTo60(dist));
  }

  function updateUI() {
    if (state.temp != null) tempSpan.textContent = state.temp.toFixed(1);
    if (state.hum != null) humSpan.textContent = state.hum.toFixed(1);
    if (state.dist != null) distSpan.textContent = state.dist.toFixed(1);

    nodeIdSpan.textContent = state.nodeId ?? "-";
    roleSpan.textContent = state.role ?? "-";
    nodeCountSpan.textContent = state.nodes;
    neighborsSpan.textContent = state.neighbors.join(", ") || "-";

    lastUpdateSpan.textContent =
      "Last update: " + new Date().toLocaleTimeString();

    pushToCharts(state.temp, state.hum, state.dist);
  }

  function setConnected(flag) {
    connStatus.textContent = flag ? "Connected" : "Disconnected";
    connStatus.className =
      "badge " + (flag ? "badge-connected" : "badge-disconnected");
  }

  window.updateFromPayload = (p) => {
    sampleCounter++;

    state.nodeId = p.nodeId ?? state.nodeId;
    state.role = p.role ?? state.role;
    state.nodes = p.nodes ?? state.nodes;
    state.neighbors = p.neighbors ?? state.neighbors;

    if (typeof p.temp === "number") state.temp = clampTo60(p.temp);
    if (typeof p.hum === "number") state.hum = clampTo100(p.hum);
    if (typeof p.dist === "number") state.dist = clampTo60(p.dist);

    setConnected(true);

    if (sampleCounter % 2 === 0) updateUI();
  };

  // ==== MQTT ====
  const client = mqtt.connect(MQTT_WS_URL, {
    clientId: "web_" + Math.random().toString(16).slice(2),
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    reconnectPeriod: 3000
  });

  client.on("connect", () => {
    console.log("✅ Connected");
    setConnected(true);
    client.subscribe(MQTT_TOPIC);
  });

  client.on("error", (e) => console.error("❌ MQTT Error:", e));
  client.on("close", () => setConnected(false));

  client.on("message", (_, msg) => {
    const s = msg.toString().trim();
    console.log("📩", s);

    const parts = s.split(",");
    const payload = {
      nodeId: parts[0],
      role: parts[1],
      nodes: Number(parts[2]) || 0,
      neighbors: [],
      temp: null,
      hum: null,
      dist: null
    };

    parts.forEach(p => {
      if (p.startsWith("TEMP=")) payload.temp = Number(p.slice(5));
      else if (p.startsWith("HUM=")) payload.hum = Number(p.slice(4));
      else if (p.startsWith("DIST=")) payload.dist = Number(p.slice(5));
      else if (!isNaN(p) && p !== payload.nodeId) {
        payload.neighbors.push(p);
      }
    });

    window.updateFromPayload(payload);
  });
});
