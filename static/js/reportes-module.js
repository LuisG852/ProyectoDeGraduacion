
    // Abrir modal de configuración de reporte
    function abrirConfiguracionReporte(tipo) {
        switch(tipo) {
            case 'eventos':
                loadClientesParaReporte();
                setFechasDefault('eventos');
                cargarPreviewEventos();
                openModal('configEventosModal');
                break;
            case 'inventario':
                cargarPreviewInventario();
                openModal('configInventarioModal');
                break;
            case 'problemas':
                setFechasDefault('problemas');
                cargarPreviewProblemas();
                openModal('configProblemasModal');
                break;
        }
    }

    // Cargar clientes para el filtro de reportes
    async function loadClientesParaReporte() {
        if (clientes.length === 0) {
            await loadClientes();
        }
        const select = document.getElementById('config-eventos-cliente');
        select.innerHTML = '<option value="">Todos los clientes</option>' +
            clientes.map(c => `<option value="${c.id_cliente}">${c.nombre}</option>`).join('');
    }

    // Establecer fechas por defecto
    function setFechasDefault(tipo) {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        
        if (tipo === 'eventos') {
            document.getElementById('config-eventos-fecha-inicio').value = inicioMes.toISOString().split('T')[0];
            document.getElementById('config-eventos-fecha-fin').value = hoy.toISOString().split('T')[0];
        } else if (tipo === 'problemas') {
            document.getElementById('config-problemas-fecha-inicio').value = inicioMes.toISOString().split('T')[0];
            document.getElementById('config-problemas-fecha-fin').value = hoy.toISOString().split('T')[0];
        }
    }

    // Establecer período rápido
    function setPeriodoRapido(periodo, tipo) {
        // Remover clase active de todos los botones
        const modal = tipo === 'eventos' ? 'configEventosModal' : 'configProblemasModal';
        document.querySelectorAll(`#${modal} .periodo-btn`).forEach(btn => btn.classList.remove('active'));
        
        const hoy = new Date();
        let fechaInicio, fechaFin = hoy;
        
        switch(periodo) {
            case 'hoy':
                fechaInicio = hoy;
                break;
            case 'semana':
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7);
                break;
            case 'mes':
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                break;
            case 'trimestre':
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
                break;
            case 'anio':
                fechaInicio = new Date(hoy.getFullYear(), 0, 1);
                break;
            case 'personalizado':
                event.target.classList.add('active');
                document.getElementById(`fechas-personalizadas-${tipo}`).style.display = 'grid';
                return;
        }
        
        event.target.classList.add('active');
        document.getElementById(`fechas-personalizadas-${tipo}`).style.display = 'none';
        
        if (tipo === 'eventos') {
            document.getElementById('config-eventos-fecha-inicio').value = fechaInicio.toISOString().split('T')[0];
            document.getElementById('config-eventos-fecha-fin').value = fechaFin.toISOString().split('T')[0];
            cargarPreviewEventos();
        } else if (tipo === 'problemas') {
            document.getElementById('config-problemas-fecha-inicio').value = fechaInicio.toISOString().split('T')[0];
            document.getElementById('config-problemas-fecha-fin').value = fechaFin.toISOString().split('T')[0];
            cargarPreviewProblemas();
        }
    }

    // Cargar preview de eventos
    async function cargarPreviewEventos() {
        try {
            const fechaInicio = document.getElementById('config-eventos-fecha-inicio').value;
            const fechaFin = document.getElementById('config-eventos-fecha-fin').value;
            const estado = document.getElementById('config-eventos-estado').value;
            
            let url = `/api/eventos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
            if (estado) url += `&estado=${estado}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                const eventos = data.eventos;
                const totalEventos = eventos.length;
                const totalIngresos = eventos.reduce((sum, e) => sum + parseFloat(e.monto_total || 0), 0);
                const totalPagado = eventos.reduce((sum, e) => sum + parseFloat(e.monto_pagado || 0), 0);
                const totalPendiente = totalIngresos - totalPagado;
                
                document.querySelector('#preview-eventos-stats .preview-stat:nth-child(1) .preview-stat-number').textContent = totalEventos;
                document.querySelector('#preview-eventos-stats .preview-stat:nth-child(2) .preview-stat-number').textContent = `Q${totalIngresos.toFixed(2)}`;
                document.querySelector('#preview-eventos-stats .preview-stat:nth-child(3) .preview-stat-number').textContent = `Q${totalPagado.toFixed(2)}`;
                document.querySelector('#preview-eventos-stats .preview-stat:nth-child(4) .preview-stat-number').textContent = `Q${totalPendiente.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error cargando preview:', error);
        }
    }

    // Cargar preview de inventario
    async function cargarPreviewInventario() {
        try {
            const response = await fetch('/api/articulos');
            const data = await response.json();
            
            if (data.success) {
                const articulos = data.articulos;
                const totalArticulos = articulos.length;
                const stockTotal = articulos.reduce((sum, a) => sum + (a.cantidad_total || 0), 0);
                const stockDisponible = articulos.reduce((sum, a) => sum + (a.cantidad_disponible || 0), 0);
                const valorTotal = articulos.reduce((sum, a) => sum + (parseFloat(a.precio_unitario || 0) * (a.cantidad_total || 0)), 0);
                
                document.querySelector('#preview-inventario-stats .preview-stat:nth-child(1) .preview-stat-number').textContent = totalArticulos;
                document.querySelector('#preview-inventario-stats .preview-stat:nth-child(2) .preview-stat-number').textContent = stockTotal;
                document.querySelector('#preview-inventario-stats .preview-stat:nth-child(3) .preview-stat-number').textContent = stockDisponible;
                document.querySelector('#preview-inventario-stats .preview-stat:nth-child(4) .preview-stat-number').textContent = `Q${valorTotal.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error cargando preview inventario:', error);
        }
    }

    // Cargar preview de problemas
    async function cargarPreviewProblemas() {
        try {
            const fechaInicio = document.getElementById('config-problemas-fecha-inicio').value;
            const fechaFin = document.getElementById('config-problemas-fecha-fin').value;
            
            // Aquí necesitarías un endpoint específico para problemas con filtros
            // Por ahora, mostramos datos de ejemplo
            
            document.querySelector('#preview-problemas-stats .preview-stat:nth-child(1) .preview-stat-number').textContent = '-';
            document.querySelector('#preview-problemas-stats .preview-stat:nth-child(2) .preview-stat-number').textContent = '-';
            document.querySelector('#preview-problemas-stats .preview-stat:nth-child(3) .preview-stat-number').textContent = '-';
            document.querySelector('#preview-problemas-stats .preview-stat:nth-child(4) .preview-stat-number').textContent = '-';
            
        } catch (error) {
            console.error('Error cargando preview problemas:', error);
        }
    }

    // Generar reporte de eventos con configuración
    function generarReporteEventosConfig() {
        const fechaInicio = document.getElementById('config-eventos-fecha-inicio').value;
        const fechaFin = document.getElementById('config-eventos-fecha-fin').value;
        const estado = document.getElementById('config-eventos-estado').value;
        const clienteId = document.getElementById('config-eventos-cliente').value;
        const detallado = document.getElementById('config-eventos-detallado').checked;
        
        let url = `/api/reportes/eventos/pdf?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
        if (estado) url += `&estado=${estado}`;
        if (clienteId) url += `&cliente_id=${clienteId}`;
        if (detallado) url += `&detallado=true`;
        
        window.open(url, '_blank');
        closeModal('configEventosModal');
        
        Swal.fire({
            icon: 'success',
            title: 'Reporte Generado',
            text: 'El reporte se está descargando',
            timer: 2000,
            showConfirmButton: false
        });
    }

    // Generar reporte de inventario con configuración
    function generarReporteInventarioConfig() {
        const categoria = document.getElementById('config-inventario-categoria').value;
        const stockBajo = document.getElementById('config-inventario-stock-bajo').checked;
        const valorizacion = document.getElementById('config-inventario-valorizacion').checked;
        const daniados = document.getElementById('config-inventario-daniados').checked;
        
        let url = `/api/reportes/inventario/pdf?`;
        if (categoria) url += `categoria=${categoria}&`;
        if (stockBajo) url += `stock_bajo=true&`;
        if (valorizacion) url += `valorizacion=true&`;
        if (daniados) url += `daniados=true&`;
        
        window.open(url, '_blank');
        closeModal('configInventarioModal');
        
        Swal.fire({
            icon: 'success',
            title: 'Reporte Generado',
            text: 'El reporte se está descargando',
            timer: 2000,
            showConfirmButton: false
        });
    }

    // Generar reporte de problemas con configuración
    function generarReporteProblemasConfig() {
        const fechaInicio = document.getElementById('config-problemas-fecha-inicio').value;
        const fechaFin = document.getElementById('config-problemas-fecha-fin').value;
        const tipo = document.getElementById('config-problemas-tipo').value;
        const responsable = document.getElementById('config-problemas-responsable').value;
        const graficos = document.getElementById('config-problemas-graficos').checked;
        
        let url = `/api/reportes/problemas/pdf?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
        if (tipo) url += `&tipo=${tipo}`;
        if (responsable) url += `&responsable=${responsable}`;
        if (graficos) url += `&graficos=true`;
        
        window.open(url, '_blank');
        closeModal('configProblemasModal');
        
        Swal.fire({
            icon: 'success',
            title: 'Reporte Generado',
            text: 'El reporte se está descargando',
            timer: 2000,
            showConfirmButton: false
        });
    }

    // Cargar estadísticas de reportes cuando se abre la sección
    async function loadReportesStats() {
        try {
            // Total eventos este mes
            const hoy = new Date();
            const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            const response = await fetch(`/api/eventos?fecha_inicio=${inicioMes.toISOString().split('T')[0]}&fecha_fin=${hoy.toISOString().split('T')[0]}`);
            const dataEventos = await response.json();
            
            if (dataEventos.success) {
                document.getElementById('total-eventos-mes').textContent = dataEventos.eventos.length;
            }
            
            // Valor inventario
            const responseArticulos = await fetch('/api/articulos');
            const dataArticulos = await responseArticulos.json();
            
            if (dataArticulos.success) {
                const valorTotal = dataArticulos.articulos.reduce((sum, a) => 
                    sum + (parseFloat(a.precio_unitario || 0) * (a.cantidad_total || 0)), 0
                );
                document.getElementById('valor-inventario').textContent = `Q${valorTotal.toFixed(2)}`;
            }
            
            // Problemas este mes - Por ahora dejamos en 0
            document.getElementById('reportes-problemas-mes').textContent = '0';
            
        } catch (error) {
            console.error('Error cargando stats de reportes:', error);
        }
    }