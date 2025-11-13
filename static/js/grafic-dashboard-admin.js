// ===============================================
// DASHBOARD ADMINISTRADOR CON GRÁFICAS
// ===============================================

let ingresosChart, eventosTipoChart, estadosEventosChart, topArticulosChart;

async function loadDashboardDataAdmin() {
    try {
        // Cargar estadísticas
        await loadDashboardStats();
        
        // Cargar gráficas
        await loadIngresosChart();
        await loadEventosTipoChart();
        await loadEstadosEventosChart();
        await loadTopArticulosChart();
        
        // Cargar tablas
        await loadEventosProximos();
        await loadActividadesRecientes();
        await loadInventarioBajo();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Cargar estadísticas principales
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/dashboard/stats-admin');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('stat-eventos-mes').textContent = data.stats.eventos_mes || 0;
            document.getElementById('stat-ingresos-mes').textContent = `Q${(data.stats.ingresos_mes || 0).toFixed(2)}`;
            document.getElementById('stat-cotizaciones').textContent = data.stats.cotizaciones_pendientes || 0;
            document.getElementById('stat-clientes').textContent = data.stats.clientes_activos || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Gráfica de Ingresos Mensuales
async function loadIngresosChart() {
    try {
        const response = await fetch('/api/dashboard/ingresos-mensuales-admin?year=2025');
        const data = await response.json();
        
        if (data.success) {
            const ctx = document.getElementById('ingresosChart').getContext('2d');
            
            if (ingresosChart) {
                ingresosChart.destroy();
            }
            
            ingresosChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                    datasets: [{
                        label: 'Ingresos (Q)',
                        data: data.ingresos,
                        borderColor: '#4A90E2',
                        backgroundColor: 'rgba(74, 144, 226, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#4A90E2',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // <-- AGREGADO
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return 'Q' + context.parsed.y.toFixed(2);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return 'Q' + value;
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading ingresos chart:', error);
    }
}

// Gráfica de Eventos por Tipo
async function loadEventosTipoChart() {
    try {
        const response = await fetch('/api/dashboard/eventos-por-tipo-admin');
        const data = await response.json();
        
        if (data.success) {
            const ctx = document.getElementById('eventosTipoChart').getContext('2d');
            
            if (eventosTipoChart) {
                eventosTipoChart.destroy();
            }
            
            eventosTipoChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.labels,
                    datasets: [{
                        data: data.valores,
                        backgroundColor: [
                            '#4A90E2',
                            '#27AE60',
                            '#F39C12',
                            '#9B59B6',
                            '#E74C3C',
                            '#1ABC9C'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // <-- AGREGADO
                    plugins: {
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading eventos tipo chart:', error);
    }
}

// Gráfica de Estados de Eventos
async function loadEstadosEventosChart() {
    try {
        const response = await fetch('/api/dashboard/estados-eventos-admin');
        const data = await response.json();
        
        if (data.success) {
            const ctx = document.getElementById('estadosEventosChart').getContext('2d');
            
            if (estadosEventosChart) {
                estadosEventosChart.destroy();
            }
            
            estadosEventosChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Cantidad',
                        data: data.valores,
                        backgroundColor: '#4A90E2',
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // <-- AGREGADO
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading estados chart:', error);
    }
}

// Gráfica de Top Artículos
async function loadTopArticulosChart() {
    try {
        const response = await fetch('/api/dashboard/top-articulos-admin');
        const data = await response.json();
        
        if (data.success) {
            const ctx = document.getElementById('topArticulosChart').getContext('2d');
            
            if (topArticulosChart) {
                topArticulosChart.destroy();
            }
            
            topArticulosChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Veces Rentado',
                        data: data.valores,
                        backgroundColor: '#27AE60',
                        borderRadius: 8
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false, // <-- AGREGADO
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading top articulos chart:', error);
    }
}


// Funciones auxiliares
function getBadgeClass(estado) {
    const map = {
        'reservado': 'info',
        'confirmado': 'success',
        'pendiente_pago': 'warning',
        'cancelado': 'danger'
    };
    return map[estado] || 'info';
}

function getActivityIcon(tipo) {
    const map = {
        'success': 'check',
        'warning': 'exclamation-triangle',
        'danger': 'times-circle',
        'info': 'info-circle'
    };
    return map[tipo] || 'circle';
}

function getTimeAgo(fecha) {
    if (!fecha) return 'Fecha desconocida';
    
    const now = new Date();
    const past = new Date(fecha);
    const diff = Math.floor((now - past) / 1000);
    
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
    return `Hace ${Math.floor(diff / 86400)} días`;
}