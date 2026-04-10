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

let sampleCounter = 0;

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

  // ==== Chart (Temp, Humidity, Distance scope style, last 10 points) ====
  const combinedChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Temp °C",
          data: [],
          borderColor: "#ff6b6b",
          backgroundColor: "rgba(255,107,107,0.25)",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true,
          yAxisID: "yLeft"
        },
        {
          label: "Humidity %",
          data: [],
          borderColor: "#1e90ff",
          backgroundColor: "rgba(30,144,255,0.25)",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true,
          yAxisID: "yLeft"
        },
        {
          label: "Distance cm",
          data: [],
          borderColor: "#f2c94c",
          backgroundColor: "rgba(242,201,76,0.18)",
          borderWidth: 1.8,
          tension: 0.4,
          pointRadius: 0,
          fill: true,
          yAxisID: "yRight"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 300,
        easing: "easeOutQuad"
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#c5c6c7",
            boxWidth: 8,
            font: { size: 10 }
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(15,20,30,0.9)",
          borderColor: "rgba(255,255,255,0.15)",
          borderWidth: 1,
          titleColor: "#ffffff",
          bodyColor: "#c5c6c7",
          displayColors: true
        }
      },
      scales: {
        x: {
          ticks: {
            color: "rgba(197,198,199,0.7)",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
            font: { size: 9 }
          },
          grid: {
            color: "rgba(255,255,255,0.04)",
            drawBorder: false
          }
        },
        yLeft: {
          type: "linear",
          position: "left",
          ticks: {
            color: "rgba(197,198,199,0.8)",
            font: { size: 9 }
          },
          grid: {
            color: "rgba(255,255,255,0.04)",
            drawBorder: false
          }
        },
        yRight: {
          type: "linear",
          position: "right",
          ticks: {
            color: "#f2c94c",
            font: { size: 9 }
          },
          grid: { display: false }
        }
      }
    }
  });

  // Optional: per-line gradient fills (nicer)
  const h = canvas.height || 200;
  const gradTemp = ctx.createLinearGradient(0, 0, 0, h);
  gradTemp.addColorStop(0, "rgba(255,107,107,0.35)");
  gradTemp.addColorStop(1, "rgba(255,107,107,0)");

  const gradHum = ctx.createLinearGradient(0, 0, 0, h);
  gradHum.addColorStop(0, "rgba(30,144,255,0.35)");
  gradHum.addColorStop(1, "rgba(30,144,255,0)");

  const gradDist = ctx.createLinearGradient(0, 0, 0, h);
  gradDist.addColorStop(0, "rgba(242,201,76,0.30)");
  gradDist.addColorStop(1, "rgba(242,201,76,0)");

  combinedChart.data.datasets[0].backgroundColor = gradTemp;
  combinedChart.data.datasets[1].backgroundColor = gradHum;
  combinedChart.data.datasets[2].backgroundColor = gradDist;

  function pushToCombinedChart(temp, hum, dist) {
    const labels = combinedChart.data.labels;
    const dTemp = combinedChart.data.datasets[0].data;
    const dHum = combinedChart.data.datasets[1].data;
    const dDist = combinedChart.data.datasets[2].data;

    const now = new Date();
    const t = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    labels.push(t);
    dTemp.push(temp != null ? temp : null);
    dHum.push(hum != null ? hum : null);
    dDist.push(dist != null ? dist : null);

    const MAX_POINTS = 10;
    while (labels.length > MAX_POINTS) {
      labels.shift();
      dTemp.shift();
      dHum.shift();
      dDist.shift();
    }

    combinedChart.update();
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

  // ==== Update from parsed payload with light throttling ====
  window.updateFromPayload = function (payload) {
    sampleCounter++;

    state.nodeId = payload.nodeId ?? state.nodeId;
    state.role = payload.role ?? state.role;
    state.nodes = payload.nodes ?? state.nodes;
    state.neighbors = payload.neighbors ?? state.neighbors;
    if (typeof payload.temp === "number") state.temp = payload.temp;
    if (typeof payload.hum === "number") state.hum = payload.hum;
    if (typeof payload.dist === "number") state.dist = payload.dist;

    setConnected(true);

    // Only animate chart + log every 2nd message
    if (sampleCounter % 2 === 0) {
      updateUI();
      addEventLogEntry(payload);
    } else {
      // Still keep numbers fresh
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
