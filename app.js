const API_URL = "http://localhost:8000";
let simulacionActual = null;
let chartInstancia = null;

// Inicialización del Dashboard
async function inicializar() {
    await cargarSimulaciones();
    
    // Polling: Actualizar cada 5 segundos
    setInterval(actualizarDashboard, 5000);
}

// 1. Cargar selector
async function cargarSimulaciones() {
    try {
        const resp = await fetch(`${API_URL}/simulaciones`);
        const simulaciones = await resp.json();
        const selector = document.getElementById("sim-selector");
        
        simulaciones.forEach(sim => {
            const opt = document.createElement("option");
            opt.value = sim;
            opt.textContent = sim;
            selector.appendChild(opt);
        });

        if (simulaciones.length > 0) {
            simulacionActual = simulaciones[0];
            selector.addEventListener("change", (e) => {
                simulacionActual = e.target.value;
                actualizarDashboard();
            });
            actualizarDashboard();
        }
    } catch (e) {
        mostrarError(true);
    }
}

// 2. Orquestador de actualizaciones
async function actualizarDashboard() {
    if (!simulacionActual) return;
    
    try {
        const [estadoResp, lecturasResp] = await Promise.all([
            fetch(`${API_URL}/estado_camaras/${simulacionActual}`),
            fetch(`${API_URL}/ultimas_lecturas/${simulacionActual}`)
        ]);

        if (!estadoResp.ok || !lecturasResp.ok) throw new Error("Fallo en API");

        const estadoCamaras = await estadoResp.json();
        const ultimasLecturas = await lecturasResp.json();

        pintarTarjetas(estadoCamaras);
        pintarTabla(ultimasLecturas);
        actualizarGrafica(ultimasLecturas);
        
        document.getElementById("ultima-act").textContent = new Date().toLocaleTimeString();
        mostrarError(false);
    } catch (error) {
        mostrarError(true);
    }
}

// 3. Pintar Tarjetas (Esquema de Cámaras)
function pintarTarjetas(camaras) {
    const contenedor = document.getElementById("contenedor-camaras");
    contenedor.innerHTML = ""; // Limpiar

    camaras.forEach(cam => {
        let claseColor = cam.status === "ALERTA" ? "alerta" : (cam.status === "SIN DATOS" ? "sin-datos" : "ok");
        let tempHtml = cam.temperature ? `${cam.temperature} °C` : `N/A`;

        const tarjeta = `
            <div class="col">
                <div class="card text-center ${claseColor} shadow-sm h-100">
                    <div class="card-header">${cam.name} (${cam.chamber_id})</div>
                    <div class="card-body">
                        <h2 class="card-title">${tempHtml}</h2>
                        <p class="card-text mb-1">Límite: ${cam.limit || '-'} °C</p>
                        <small>Alertas Históricas: ${cam.total_alerts || 0}</small><br>
                    </div>
                </div>
            </div>`;
        contenedor.innerHTML += tarjeta;
    });
}

// 4. Pintar Tabla de últimas lecturas
function pintarTabla(lecturas) {
    const tbody = document.getElementById("tabla-lecturas");
    tbody.innerHTML = "";

    lecturas.forEach(lec => {
        let exceso = 0;
        let colorFila = "";
        if (lec.temperature_c > lec.upper_limit_c) {
            exceso = (lec.temperature_c - lec.upper_limit_c).toFixed(2);
            colorFila = "table-danger"; // Alerta visual en tabla
        }

        tbody.innerHTML += `
            <tr class="${colorFila}">
                <td>${lec.chamber_id}</td>
                <td><small>${lec.batch_id}</small></td>
                <td>${lec.temperature_c}</td>
                <td>${lec.upper_limit_c}</td>
                <td>${exceso > 0 ? '+' + exceso : '-'}</td>
            </tr>
        `;
    });
}

// 5. Gráfica con Chart.js
function actualizarGrafica(lecturas) {
    // Invertimos las lecturas para que el tiempo vaya de izquierda a derecha
    const datosOrdenados = [...lecturas].reverse();
    
    const etiquetas = datosOrdenados.map(l => {
        let d = new Date(l.measured_at);
        return `${d.getHours()}:${d.getMinutes()}`;
    });
    const temperaturas = datosOrdenados.map(l => l.temperature_c);

    if (chartInstancia) chartInstancia.destroy();

    const ctx = document.getElementById('graficaTemperaturas').getContext('2d');
    chartInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Temperatura Registrada',
                data: temperaturas,
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.1
            }]
        },
        options: { animation: false } // Desactivamos animación para que el polling sea fluido
    });
}

function mostrarError(mostrar) {
    const badge = document.getElementById("error-api");
    if (mostrar) badge.classList.remove("d-none");
    else badge.classList.add("d-none");
}

window.onload = inicializar;
