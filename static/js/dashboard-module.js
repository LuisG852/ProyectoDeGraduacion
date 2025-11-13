    // ===============================================
    // DASHBOARD - DATOS PRINCIPALES
    // ===============================================
    async function loadDashboardData() {
        try {
            const stats = await fetch('/api/dashboard/stats').then(r => r.json());
            if (stats.success) {
                document.getElementById('total-eventos').textContent = stats.total_eventos || 0;
                document.getElementById('eventos-hoy').textContent = stats.eventos_hoy || 0;
                document.getElementById('cotizaciones-pendientes').textContent = stats.cotizaciones_pendientes || 0;
                document.getElementById('total-clientes').textContent = stats.total_clientes || 0;
            }
            loadEventosProximos();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async function loadEventosProximos() {
        try {
            const response = await fetch('/api/eventos/proximos');
            const data = await response.json();
            
            const container = document.getElementById('eventos-proximos');
            
            if (data.success && data.eventos.length > 0) {
                container.innerHTML = data.eventos.map(evento => `
                    <div class="evento-item">
                        <div class="evento-header">
                            <strong>${evento.cliente_nombre}</strong>
                            <span class="status-badge status-${evento.estado}">${evento.estado}</span>
                        </div>
                        <div class="evento-details">
                            <p><i class="fas fa-calendar"></i> ${formatDate(evento.fecha_evento)}</p>
                            <p><i class="fas fa-clock"></i> ${evento.hora_inicio} - ${evento.hora_fin}</p>
                            <p><i class="fas fa-map-marker-alt"></i> ${evento.lugar_evento}</p>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="text-muted">No hay eventos próximos</p>';
            }
        } catch (error) {
            console.error('Error loading eventos próximos:', error);
            document.getElementById('eventos-proximos').innerHTML = '<p class="text-muted">Error cargando eventos</p>';
        }
    }

    