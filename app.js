// ==== CONFIG: HIVEMQ CLOUD ====
const MQTT_WS_URL =
  'wss://63a94dada2fa46b797e4d6fdf720f43f.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USERNAME = 'JunJuly';   // <-- change
const MQTT_PASSWORD = 'JuneJuly1';   // <-- change
const MQTT_TOPIC = 'esp32/mesh/debug';        // match your ESP32 publish topic

// ==== Simple local state ====
const state = {
  temp: null,
  hum: null,
  dist: null,
  nodeId: null,
  role: null,
  nodes: 0,
  neighbors: []
};

// ==== DOM refs ====
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

// ==== Charts setup ====
function createLineChart(ctx, color) {
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "",
          data: [],
          borderColor: color,
          backgroundColor: color + "22",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          ticks: { color: "#c5c6c7" },
          grid: { color: "rgba(255,255,255,0.05)" }
        }
      }
    }
  });
}

const tempChart = createLineChart(
  document.getElementById("temp-chart").getContext("2d"),
  "#66fcf1"
);
const humChart = createLineChart(
  document.getElementById("hum-chart").getContext("2d"),
  "#45a29e"
);
const distChart = createLineChart(
  document.getElementById("dist-chart").getContext("2d"),
  "#f2c94c"
);

function pushToChart(chart, value) {
  if (value == null || isNaN(value)) return;
  const labels = chart.data.labels;
  const data = chart.data.datasets[0].data;

  const now = new Date();
  const t = now.toLocaleTimeString("en-US", { hour12: false });

  labels.push(t);
  data.push(value);

  if (labels.length > 50) {
    labels.shift();
    data.shift();
  }
  chart.update("none");
}

// ==== Event log ====
function addEventLogEntry(payload) {
  if (!eventLog) return;
  const li = document.createElement("li");

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false });

  const timeSpan = document.createElement("span");
  timeSpan.className = "event-log-time";
  timeSpan.textContent = timeStr;

  const text = document.createTextNode(
    `ID=${payload.nodeId ?? "-"} ROLE=${payload.role ?? "-"} ` +
      `TEMP=${payload.temp?.toFixed?.(1) ?? "-"} ` +
      `HUM=${payload.hum?.toFixed?.(1) ?? "-"} ` +
      `DIST=${payload.dist?.toFixed?.(1) ?? "-"}`
  );

  li.appendChild(timeSpan);
  li.appendChild(text);

  eventLog.insertBefore(li, eventLog.firstChild);

  while (eventLog.children.length > 30) {
    eventLog.removeChild(eventLog.lastChild);
  }
}

// ==== UI update ====
function updateUI() {
  if (state.temp != null) tempSpan.textContent = state.temp.toFixed(1);
  if (state.hum != null) humSpan.textContent = state.hum.toFixed(1);
  if (state.dist != null) distSpan.textContent = state.dist.toFixed(1);

  nodeIdSpan.textContent = state.nodeId ?? "-";
  roleSpan.textContent = state.role ?? "-";
  nodeCountSpan.textContent = state.nodes ?? 0;

  neighborsSpan.textContent =
    state.neighbors && state.neighbors.length
      ? state.neighbors.join(", ")
      : "-";

  const now = new Date();
  lastUpdateSpan.textContent = "Last update: " + now.toLocaleTimeString();

  pushToChart(tempChart, state.temp);
  pushToChart(humChart, state.hum);
  pushToChart(distChart, state.dist);
}

// ==== Connection badge helpers ====
function setConnected(flag) {
  if (!connStatus) return;
  if (flag) {
    connStatus.textContent = "Connected";
    connStatus.classList.remove("badge-disconnected");
    connStatus.classList.add("badge-connected");
  } else {
    connStatus.textContent = "Disconnected";
    connStatus.classList.remove("badge-connected");
    connStatus.classList.add("badge-disconnected");
  }
}

// Expose for MQTT / other inputs
window.updateFromPayload = function (payload) {
  state.nodeId = payload.nodeId ?? state.nodeId;
  state.role = payload.role ?? state.role;
  state.nodes = payload.nodes ?? state.nodes;
  state.neighbors = payload.neighbors ?? state.neighbors;
  if (typeof payload.temp === "number") state.temp = payload.temp;
  if (typeof payload.hum === "number") state.hum = payload.hum;
  if (typeof payload.dist === "number") state.dist = payload.dist;

  setConnected(true);
  updateUI();
  addEventLogEntry(payload);
};

// ==== MQTT: connect to HiveMQ Cloud over WebSockets ====
(function setupMqtt() {
  const options = {
    clientId: 'web_' + Math.random().toString(16).slice(2),
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD
  };

  const client = mqtt.connect(MQTT_WS_URL, options);

  client.on('connect', () => {
    console.log('Connected to HiveMQ via WebSockets');
    setConnected(true);
    client.subscribe(MQTT_TOPIC, (err) => {
      if (err) console.error('Subscribe error:', err);
      else console.log('Subscribed to', MQTT_TOPIC);
    });
  });

  client.on('reconnect', () => {
    console.log('Reconnecting...');
  });

  client.on('close', () => {
    console.log('Connection closed');
    setConnected(false);
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
    setConnected(false);
  });

  client.on('message', (topic, message) => {
    const s = message.toString();
    // example payload:
    // 258509481,ROOT,1,3637930473,TEMP=25.7,HUM=61.0,DIST=102.0
    const parts = s.split(',');

    const payload = {
      nodeId: null,
      role: null,
      nodes: 0,
      neighbors: [],
      temp: null,
      hum: null,
      dist: null
    };

    if (parts.length >= 3) {
      payload.nodeId = parts[0];
      payload.role = parts[1];
      payload.nodes = Number(parts[2]) || 0;
    }

    parts.forEach(p => {
      if (p.startsWith('TEMP=')) payload.temp = Number(p.slice(5));
      else if (p.startsWith('HUM=')) payload.hum = Number(p.slice(4));
      else if (p.startsWith('DIST=')) payload.dist = Number(p.slice(5));
      else if (!isNaN(Number(p)) && p !== payload.nodeId) {
        payload.neighbors.push(p);
      }
    });

    window.updateFromPayload(payload);
  });
})();
