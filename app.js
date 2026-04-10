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

  // charts
  pushToChart(tempChart, state.temp);
  pushToChart(humChart, state.hum);
  pushToChart(distChart, state.dist);
}

// ==== Connection badge helpers (we'll hook to real connection later) ====
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

// Call this with parsed payload
window.updateFromPayload = function (payload) {
  // payload example:
  // {
  //   nodeId: "258509481",
  //   role: "ROOT",
  //   nodes: 1,
  //   neighbors: ["3637930473"],
  //   temp: 25.7,
  //   hum: 61.0,
  //   dist: 102.0
  // }
  state.nodeId = payload.nodeId ?? state.nodeId;
  state.role = payload.role ?? state.role;
  state.nodes = payload.nodes ?? state.nodes;
  state.neighbors = payload.neighbors ?? state.neighbors;
  if (typeof payload.temp === "number") state.temp = payload.temp;
  if (typeof payload.hum === "number") state.hum = payload.hum;
  if (typeof payload.dist === "number") state.dist = payload.dist;

  setConnected(true);
  updateUI();
};

// ==== Demo: fake data to test UI without MQTT ====
(function demoFake() {
  let t = 25.0;
  let h = 60.0;
  let d = 100.0;

  setInterval(() => {
    t += 0.1;
    if (t > 30) t = 25;
    h += 0.2;
    if (h > 70) h = 60;
    d += 1;
    if (d > 120) d = 100;

    window.updateFromPayload({
      nodeId: "258509481",
      role: "ROOT",
      nodes: 2,
      neighbors: ["3637930473"],
      temp: t,
      hum: h,
      dist: d
    });
  }, 3000);
})();