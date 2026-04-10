// ==== CONFIG: HIVEMQ CLOUD ====
const MQTT_WS_URL =
  'wss://63a94dada2fa46b797e4d6fdf720f43f.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USERNAME = 'JuneJuly';     // your user
const MQTT_PASSWORD = 'JuneJuly1';    // your password
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

// Run only after DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  // ==== DOM ====
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

  const canvas = document.getElementById("combined-chart");
  if (!canvas) {
    console.error("combined-chart canvas not found");
    return;
  }
  const ctx = canvas.getContext("2d");

  // ==== Chart (combined) ====
  const combinedChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Temp °C",
          data: [],
          borderColor: "#66fcf1",
          backgroundColor: "#66fcf122",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0,
          yAxisID: "y1"
        },
        {
          label: "Humidity %",
          data: [],
          borderColor: "#45a29e",
          backgroundColor: "#45a29e22",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0,
          yAxisID: "y2"
        },
        {
          label: "Distance cm",
          data: [],
          borderColor: "#f2c94c",
          backgroundColor: "#f2c94c22",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0,
          yAxisID: "y3"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#c5c6c7", boxWidth: 8, font: { size: 10 } }
        }
      },
      scales: {
        x: {
          ticks: { color: "#c5c6c7", maxRotation: 0, autoSkip: true },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        y1: {
          type: "linear",
          position: "left",
          ticks: { color: "#66fcf1", font: { size: 9 } },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        y2: {
          type: "linear",
          position: "right",
          ticks: { color: "#45a29e", font: { size: 9 } },
          grid: { display: false }
        },
        y3: {
          type: "linear",
          position: "right",
          ticks: { color: "#f2c94c", font: { size: 9 } },
          grid: { display: false },
          offset: true
        }
      }
    }
  });

  function pushToCombinedChart(temp, hum, dist) {
    const labels = combinedChart.data.labels;
    const d1 = combinedChart.data.datasets[0].data;
    const d2 = combinedChart.data.datasets[1].data;
    const d3 = combinedChart.data.datasets[2].data;

    const now = new Date();
    const t = now.toLocaleTimeString("en-US", { hour12: false });

    labels.push(t);
    d1.push(temp != null ? temp : null);
    d2.push(hum != null ? hum : null);
    d3.push(dist != null ? dist : null);

    if (labels.length > 60) {
      labels.shift();
      d1.shift(); d2.shift(); d3.shift();
    }

    combinedChart.update("none");
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
        `T=${payload.temp?.toFixed?.(1) ?? "-"} ` +
        `H=${payload.hum?.toFixed?.(1) ?? "-"} ` +
        `D=${payload.dist?.toFixed?.(1) ?? "-"}`
    );

    li.appendChild(timeSpan);
    li.appendChild(text);

    eventLog.insertBefore(li, eventLog.firstChild);

    while (eventLog.children.length > 40) {
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

    pushToCombinedChart(state.temp, state.hum, state.dist);
  }

  // ==== Connection badge ====
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

  // ==== Update from parsed payload ====
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

  // ==== MQTT: connect to HiveMQ Cloud ====
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
      // example: 258509481,ROOT,1,3637930473,TEMP=25.2,HUM=68.0,DIST=101.0
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
});
