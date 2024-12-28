let satellites = new Map();
let position = null;

const layout = {
    xaxis: {
        range: [-100, 100],
        title: 'X (км)'
    },
    yaxis: {
        range: [-100, 100],
        title: 'Y (км)'
    }
};

Plotly.newPlot('gpsPlot', [], layout);

let socket = new WebSocket('ws://localhost:4001');

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    satellites.set(data.id, {
        x: data.x,
        y: data.y,
        sentAt: data.sentAt,
        receivedAt: data.receivedAt,
        lastUpdate: Date.now()
    });

    // Очищаем старые данные
    const now = Date.now();
    for (let [id, sat] of satellites.entries()) {
        if (now - sat.lastUpdate > 5000) {
            satellites.delete(id);
        }
    }

    if (satellites.size >= 3) {
        position = calculatePosition();
    }

    updatePlot();
};

function calculatePosition() {
    if (satellites.size < 3) return null;

    const sats = Array.from(satellites.values());
    const [p1, p2, p3] = sats.slice(0, 3);

    // Расчет расстояний
    const r1 = calculateDistance(p1);
    const r2 = calculateDistance(p2);
    const r3 = calculateDistance(p3);

    // Трилатерация
    const A = 2 * p2.x - 2 * p1.x;
    const B = 2 * p2.y - 2 * p1.y;
    const C = r1 * r1 - r2 * r2 - p1.x * p1.x + p2.x * p2.x - p1.y * p1.y + p2.y * p2.y;
    const D = 2 * p3.x - 2 * p2.x;
    const E = 2 * p3.y - 2 * p2.y;
    const F = r2 * r2 - r3 * r3 - p2.x * p2.x + p3.x * p3.x - p2.y * p2.y + p3.y * p3.y;

    const x = (C * E - F * B) / (E * A - B * D);
    const y = (C * D - A * F) / (B * D - A * E);

    return { x, y };
}

function calculateDistance(satellite) {
    const SPEED_OF_LIGHT = 299792.458;
    const timeOfFlight = (satellite.receivedAt - satellite.sentAt) / 1000;
    return timeOfFlight * SPEED_OF_LIGHT;
}

function updatePlot() {
    const data = [
        {
            x: Array.from(satellites.values()).map(s => s.x),
            y: Array.from(satellites.values()).map(s => s.y),
            mode: 'markers',
            type: 'scatter',
            name: 'Супутники',
            marker: { size: 10 }
        }
    ];

    if (position) {
        data.push({
            x: [position.x],
            y: [position.y],
            mode: 'markers',
            type: 'scatter',
            name: 'Об\'єкт',
            marker: { size: 12 }
        });
    }

    Plotly.react('gpsPlot', data, layout);
}

function updateConfig() {
    const config = {
        messageFrequency: parseInt(document.getElementById('freq').value),
        satelliteSpeed: parseInt(document.getElementById('satSpeed').value),
        objectSpeed: parseInt(document.getElementById('objSpeed').value)
    };

    fetch('http://localhost:4001/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
}

socket.onclose = () => {
    setTimeout(() => {
        socket = new WebSocket('ws://localhost:4001');
    }, 1000);
};