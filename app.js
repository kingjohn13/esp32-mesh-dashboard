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

// Clamp helpers
function clampTo60(value) {
  if (value == null || isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 60) return 60;
  return value;
}

function clampTo100(value) {
  if (value == null || isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

// Chart options (axes fixed, no animation)
const options0to60 = {
  responsive: false,
  maintainAspectRatio: false,
  animation: false,
  layout: {
    padding: 0
  },
  plugins: { legend: { display: false } },
  scales: {
    x: {
      offset: false,
      ticks: {
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
      min: 0,
      max: 60,
      ticks: {
        color: "rgba(197,198,199,0.7)",
        font: { size: 8 },
        stepSize: 10
      },
      grid: {
        color: "rgba(255,255,255,0.04)",
        drawBorder: false
      }
    }
  }
};

const options0to100 = {
  responsive: false,
  maintainAspectRatio: false,
  animation: false,
  layout: {
    padding: 0
  },
  plugins: { legend: { display: false } },
  scales: {
    x: {
      offset: false,
      ticks: {
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
      min: 0,
      max: 100,
      ticks: {
        color: "rgba(197,198,199,0.7)",
        font: { size: 8 },
        stepSize: 20
      },
      grid: {
        color: "rgba(255,255,255,0.04)",
        drawBorder: false
      }
    }
  }
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

  // ==== Charts: 3 separate canvases ====
  const tempChart = new Chart(
    document.getElementById("temp-chart").getContext("2d"),
    {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Temp °C",
          data: [],
          borderColor: "#ff6b6b",
          backgroundColor: "rgba(255,107,107,0.2)",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true
        }]
      },
      options: options0to60
    }
  );

  const humChart = new Chart(
    document.getElementById("hum-chart").getContext("2d"),
    {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Humidity %",
          data: [],
          borderColor: "#1e90ff",
          backgroundColor: "rgba(30,144,255,0.2)",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true
        }]
      },
      options: options0to100
    }
  );

  const distChart = new Chart(
    document.getElementById("dist-chart").getContext("2d"),
    {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Distance cm",
          data: [],
          borderColor: "#f2c94c",
          backgroundColor: "rgba(242,201,76,0.2)",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true
        }]
      },
      options: options0to60
    }
  );

  function pushToCharts(temp, hum, dist) {
    const now = new Date();
    const t = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const MAX_POINTS = 10;

    const cTemp = temp != null ? clampTo60(temp)   : null;
    const cHum  = hum  != null ? clampTo100(hum)  : null;
    const cDist = dist != null ? clampTo60(dist)  : null;

    // Temp
    if (cTemp != null) {
      tempChart.data.labels.push(t);
      tempChart.data.datasets[0].data.push(cTemp);
      while (tempChart.data.labels.length > MAX_POINTS) {
        tempChart.data.labels.shift();
        tempChart.data.datasets[0].data.shift();
      }
      tempChart.update('none');
    }

    // Humidity
    if (cHum != null) {
      humChart.data.labels.push(t);
      humChart.data.datasets[0].data.push(cHum);
      while (humChart.data.labels.length > MAX_POINTS) {
        humChart.data.labels.shift();
        humChart.data.datasets[0].data.shift();
      }
      humChart.update('none');
    }

    // Distance
    if (cDist != null) {
      distChart.data.labels.push(t);
      distChart.data.datasets[0].data.push(cDist);
      while (distChart.data.labels.length > MAX_POINTS) {
        distChart.data.labels.shift();
        distChart.data.datasets[0].data.shift();
      }
      distChart.update('none');
    }
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
    if (state.temp != null) tempSpan.textContent = clampTo60(state.temp).toFixed(1);
    if (state.hum != null) humSpan.textContent = clampTo100(state.hum).toFixed(1);
    if (state.dist != null) distSpan.textContent = clampTo60(state.dist).toFixed(1);

    nodeIdSpan.textContent = state.nodeId ?? "-";
    roleSpan.textContent = state.role ?? "ROOT";
    nodeCountSpan.textContent = state.nodes ?? 0;

    neighborsSpan.textContent =
      state.neighbors && state.neighbors.length
        ? state.neighbors.join(", ")
        : "-";

    const now = new Date();
    lastUpdateSpan.textContent = "Last update: " + now.toLocaleTimeString();

    pushToCharts(state.temp, state.hum, state.dist);
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

  // ==== Update from parsed payload with light throttling ====
  window.updateFromPayload = function (payload) {
    sampleCounter++;

    state.nodeId = payload.nodeId ?? state.nodeId;
    state.role = payload.role ?? state.role;
    state.nodes = payload.nodes ?? state.nodes;
    state.neighbors = payload.neighbors ?? state.neighbors;

    if (typeof payload.temp === "number") state.temp = clampTo60(payload.temp);
    if (typeof payload.hum === "number") state.hum = clampTo100(payload.hum);
    if (typeof payload.dist === "number") state.dist = clampTo60(payload.dist);

    setConnected(true);

    if (sampleCounter % 2 === 0) {
      updateUI();
      addEventLogEntry(payload);
    } else {
      if (state.temp != null) tempSpan.textContent = state.temp.toFixed(1);
      if (state.hum != null) humSpan.textContent = state.hum.toFixed(1);
      if (state.dist != null) distSpan.textContent = state.dist.toFixed(1);
    }
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

    // ===== FLEXIBLE PARSER =====
    client.on('message', (topic, message) => {
      const s = message.toString();
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

      const hasKeyStyle = parts.some(p =>
        p.startsWith('TEMP=') || p.startsWith('HUM=') || p.startsWith('DIST=')
      );

      if (hasKeyStyle && parts.length >= 3 && (parts[1] === 'ROOT' || parts[1] === 'NODE')) {
        // Format 1: nodeId,ROLE,nodes,...,TEMP=xx,HUM=yy,DIST=zz
        payload.nodeId = parts[0];
        payload.role = parts[1];
        payload.nodes = Number(parts[2]) || 0;

        parts.forEach(p => {
          if (p.startsWith('TEMP=')) payload.temp = Number(p.slice(5));
          else if (p.startsWith('HUM=')) payload.hum = Number(p.slice(4));
          else if (p.startsWith('DIST=')) payload.dist = Number(p.slice(5));
          else if (!isNaN(Number(p)) && p !== payload.nodeId) {
            payload.neighbors.push(p);
          }
        });
      } else if (parts.length >= 5) {
        // Format 2: nodeId,temp,hum,dist,nodeCount
        // Example: 3624150137,34.20,66.60,9.18,0
        payload.nodeId = parts[0];
        payload.role = "ROOT";
        payload.temp = Number(parts[1]);
        payload.hum  = Number(parts[2]);
        payload.dist = Number(parts[3]);
        payload.nodes = Number(parts[4]) || 0;
      }

      window.updateFromPayload(payload);
    });
  })();
});
