const MQTT_WS_URL =
  'wss://63a94dada2fa46b797e4d6fdf720f43f.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USERNAME = 'JuneJuly';
const MQTT_PASSWORD = 'JuneJuly1';
const MQTT_TOPIC = 'esp32/mesh/debug';

const nodes = new Map();

window.addEventListener("DOMContentLoaded", () => {
  const meshNodeCountSpan = document.getElementById("mesh-node-count");
  const connStatus = document.getElementById("conn-status");
  const lastUpdateSpan = document.getElementById("last-update");
  const tbody = document.getElementById("nodes-tbody");
  const eventLog = document.getElementById("event-log");

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

  function clamp(val, min, max) {
    if (val == null || isNaN(val)) return 0;
    if (val < min) return min;
    if (val > max) return max;
    return val;
  }

  function renderTable(highlightNodeId = null) {
    if (!tbody) return;
    tbody.innerHTML = "";

    const rows = Array.from(nodes.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    rows.forEach(([id, info]) => {
      const tr = document.createElement("tr");
      if (highlightNodeId && id === highlightNodeId) {
        tr.classList.add("highlight");
        setTimeout(() => tr.classList.remove("highlight"), 800);
      }

      const tTemp  = clamp(info.temp, 0, 60);
      const tHum   = clamp(info.hum, 0, 100);
      const tWater = clamp(info.water, 0, 60); // adjust max if your sensor height != 60

      const tdId   = document.createElement("td");
      const tdRole = document.createElement("td");
      const tdT    = document.createElement("td");
      const tdH    = document.createElement("td");
      const tdW    = document.createElement("td");
      const tdTime = document.createElement("td");

      tdId.textContent   = id;
      tdRole.textContent = info.role || "NODE";
      tdT.textContent    = info.temp != null ? tTemp.toFixed(1)  : "-";
      tdH.textContent    = info.hum  != null ? tHum.toFixed(1)   : "-";
      tdW.textContent    = info.water != null ? tWater.toFixed(1) : "-";
      tdTime.textContent = info.lastUpdate || "-";

      tr.appendChild(tdId);
      tr.appendChild(tdRole);
      tr.appendChild(tdT);
      tr.appendChild(tdH);
      tr.appendChild(tdW);
      tr.appendChild(tdTime);
      tbody.appendChild(tr);
    });

    meshNodeCountSpan.textContent = rows.length;
  }

  function addEventLogEntry(nodeId, data) {
    if (!eventLog) return;

    const li = document.createElement("li");

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour12: false });

    const timeSpan = document.createElement("span");
    timeSpan.className = "event-log-time";
    timeSpan.textContent = timeStr;

    const text = document.createTextNode(
      `ID=${nodeId} ` +
        `T=${data.temp != null ? data.temp.toFixed(1) : "-"} ` +
        `H=${data.hum != null ? data.hum.toFixed(1) : "-"} ` +
        `W=${data.water != null ? data.water.toFixed(1) : "-"}`
    );

    li.appendChild(timeSpan);
    li.appendChild(text);

    eventLog.insertBefore(li, eventLog.firstChild);
    while (eventLog.children.length > 40) {
      eventLog.removeChild(eventLog.lastChild);
    }
  }

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

    // New format: nodeId,ROLE,nodeCount,temp,hum,waterLevel
    client.on('message', (topic, message) => {
      const s = message.toString().trim();
      const parts = s.split(',');

      if (parts.length < 6) return;

      const nodeId      = parts[0];
      const role        = parts[1];
      const count       = Number(parts[2]) || 0;
      const temp        = Number(parts[3]);
      const hum         = Number(parts[4]);
      const waterLevel  = Number(parts[5]);

      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", { hour12: false });

      nodes.set(nodeId, {
        role: role,
        temp,
        hum,
        water: waterLevel,
        lastUpdate: timeStr
      });

      lastUpdateSpan.textContent = "Last update: " + timeStr;
      if (count > 0) {
        meshNodeCountSpan.textContent = count;
      } else {
        meshNodeCountSpan.textContent = nodes.size;
      }
      renderTable(nodeId);
      addEventLogEntry(nodeId, { temp, hum, water: waterLevel });
    });
  })();
});
