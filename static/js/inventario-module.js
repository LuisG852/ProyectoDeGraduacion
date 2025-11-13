    // ===============================================
    // GESTIÓN DE INVENTARIO (ARTÍCULOS POR EVENTO)
    // ===============================================
    async function loadEventosConArticulos() {
        try {
            const response = await fetch('/api/eventos/articulos/gestion');
            const data = await response.json();
            
            if (data.success) {
                eventosGestion = data.eventos;
                renderEventosGestion();
            }
        } catch (error) {
            console.error('Error loading eventos con artículos:', error);
        }
    }

    function renderEventosGestion() {
        const tbody = document.getElementById('gestion-eventos-table-body');
        
        if (eventosGestion.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay eventos con artículos pendientes</td></tr>';
            return;
        }

        tbody.innerHTML = eventosGestion.map(evento => {
            const porcentaje = Math.round(((evento.articulos_devueltos || 0) / evento.total_articulos) * 100);
            
            return `
                <tr>
                    <td><strong>${evento.numero_evento}</strong></td>
                    <td>${evento.cliente_nombre}</td>
                    <td>${formatDate(evento.fecha_evento)}</td>
                    <td><span class="status-badge status-${evento.estado}">${evento.estado}</span></td>
                    <td>${evento.total_articulos}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div style="flex: 1; background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${porcentaje}%; height: 100%; background: linear-gradient(90deg, var(--primary-color), var(--primary-light)); transition: width 0.3s;"></div>
                            </div>
                            <small style="min-width: 40px;">${porcentaje}%</small>
                        </div>
                        <small class="text-muted">
                            Reservados: ${evento.articulos_reservados} | 
                            Entregados: ${evento.articulos_entregados} | 
                            Recogido: ${evento.articulos_devueltos}
                        </small>
                    </td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="abrirGestionArticulosEvento(${evento.id_evento})" title="Gestionar Artículos">
                            <i class="fas fa-tasks"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }


        async function abrirGestionArticulosEvento(eventoId) {
        articulosSeleccionadosReporte = []; // Limpiar selección previa
        console.log('🔍 Intentando abrir gestión de artículos para evento:', eventoId);
        
        try {
            if (!eventoId || eventoId === 'undefined' || eventoId === 'null') {
                console.error('❌ ID de evento inválido:', eventoId);
                Swal.fire('Error', 'ID de evento inválido', 'error');
                return;
            }

            Swal.fire({
                title: 'Cargando...',
                text: 'Obteniendo artículos del evento',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            console.log('📡 Haciendo petición a:', `/api/eventos/${eventoId}/articulos`);
            
            const response = await fetch(`/api/eventos/${eventoId}/articulos`);
            
            console.log('📥 Respuesta recibida. Status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('📦 Datos recibidos:', data);
            
            if (data.success) {
                eventoGestionActual = data.evento;
                articulosGestionActual = data.articulos;
                
                console.log('✅ Evento:', eventoGestionActual);
                console.log('✅ Artículos cargados:', articulosGestionActual.length);
                
                document.getElementById('gestion-evento-numero').textContent = data.evento.numero_evento || 'N/A';
                document.getElementById('gestion-cliente-nombre').textContent = data.evento.cliente_nombre || 'Sin cliente';
                document.getElementById('gestion-fecha-evento').textContent = formatDate(data.evento.fecha_evento);
                document.getElementById('gestion-estado-evento').textContent = data.evento.estado || 'N/A';
                
                renderArticulosGestion();
                
                Swal.close();
                openModal('gestionArticulosEventoModal');
                
            } else {
                console.error('❌ Error en respuesta:', data.message);
                Swal.fire('Error', data.message || 'Error desconocido', 'error');
            }
        } catch (error) {
            console.error('❌ Error completo:', error);
            console.error('Stack trace:', error.stack);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                html: `
                    <p>Error cargando artículos del evento</p>
                    <small style="color: #666;">Detalles: ${error.message}</small>
                    <br><small style="color: #999;">Revisa la consola (F12) para más información</small>
                `
            });
        }
    }



    
function renderArticulosGestion() {
    const tbody = document.getElementById('gestion-articulos-detalle-body');
    
    if (articulosGestionActual.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay artículos en este evento</td></tr>';
        return;
    }

    tbody.innerHTML = articulosGestionActual.map(articulo => {
        const hasProblems = articulo.estado_articulo === 'con_problemas';
        
        // MARCAR AUTOMÁTICAMENTE si tiene problemas Y no está en la lista de seleccionados
        if (hasProblems && !articulosSeleccionadosReporte.some(a => a.id_detalle === articulo.id_detalle)) {
            articulosSeleccionadosReporte.push({
                id_detalle: articulo.id_detalle,
                id_articulo: articulo.id_articulo,
                codigo: articulo.codigo,
                nombre: articulo.nombre_articulo,
                cantidad_evento: articulo.cantidad_solicitada,
                precio_unitario: articulo.precio_unitario
            });
        }
        
        const isSelected = articulosSeleccionadosReporte.some(a => a.id_detalle === articulo.id_detalle);
        
        return `
            <tr class="${isSelected ? 'row-problema-selected' : ''}">
                <td><code>${articulo.codigo}</code></td>
                <td><strong>${articulo.nombre_articulo}</strong></td>
                <td>${articulo.cantidad_solicitada}</td>
                <td>
                    <span style="${articulo.stock_actual < 10 ? 'color: #EF4444; font-weight: 600;' : 'color: #10B981; font-weight: 600;'}">
                        ${articulo.stock_actual}
                    </span>
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" 
                        class="checkbox-problema"
                        id="problema-select-${articulo.id_detalle}"
                        ${isSelected ? 'checked' : ''}
                        data-tiene-problemas="${hasProblems}"
                        onchange="toggleSeleccionProblema(${articulo.id_detalle}, ${articulo.id_articulo}, '${articulo.codigo}', '${articulo.nombre_articulo.replace(/'/g, "&#39;")}', ${articulo.cantidad_solicitada}, ${articulo.precio_unitario})">
                </td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="verDetalleArticuloEvento(${articulo.id_detalle})" title="Ver Detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    cargarRegistroEstados();
    actualizarBotonFlotante();
}


// ===============================================
// SISTEMA DE REPORTE DE PROBLEMAS MÚLTIPLES
// ===============================================

// Toggle selección de artículo para reporte
async function toggleSeleccionProblema(detalleId, articuloId, codigo, nombre, cantidad, precio) {
    const checkbox = document.getElementById(`problema-select-${detalleId}`);
    const tieneProblemas = checkbox.getAttribute('data-tiene-problemas') === 'true';
    
    if (checkbox.checked) {
        // MARCAR: Agregar a la lista
        articulosSeleccionadosReporte.push({
            id_detalle: detalleId,
            id_articulo: articuloId,
            codigo: codigo,
            nombre: nombre,
            cantidad_evento: cantidad,
            precio_unitario: precio
        });
    } else {
        // DESMARCAR: Remover de la lista
        articulosSeleccionadosReporte = articulosSeleccionadosReporte.filter(a => a.id_detalle !== detalleId);
        
        // Si tenía problemas registrados, cambiar estado en BD
        if (tieneProblemas) {
            const confirmar = await Swal.fire({
                title: '¿Revertir estado?',
                text: 'Este artículo tiene problemas registrados. ¿Deseas cambiar su estado a "reservado"?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, revertir',
                cancelButtonText: 'Cancelar'
            });
            
            if (confirmar.isConfirmed) {
                try {
                    const response = await fetch(`/api/eventos/${eventoGestionActual.id_evento}/articulos/${detalleId}/revertir-estado`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Actualizar el estado local
                        const articulo = articulosGestionActual.find(a => a.id_detalle === detalleId);
                        if (articulo) {
                            articulo.estado_articulo = 'reservado';
                        }
                        
                        Swal.fire({
                            icon: 'success',
                            title: 'Estado revertido',
                            text: 'El artículo volvió a estado "reservado"',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                } catch (error) {
                    console.error('Error revirtiendo estado:', error);
                    Swal.fire('Error', 'No se pudo revertir el estado', 'error');
                    // Re-marcar el checkbox si falló
                    checkbox.checked = true;
                    return;
                }
            } else {
                // Canceló, re-marcar el checkbox
                checkbox.checked = true;
                return;
            }
        }
    }
    
    renderArticulosGestion();
}

// Actualizar visibilidad del contenedor de reporte dentro del modal
function actualizarBotonFlotante() {
    const container = document.getElementById('reportar-problemas-container');
    const countSpan = document.getElementById('count-seleccionados');
    
    if (articulosSeleccionadosReporte.length > 0) {
        container.style.display = 'block';
        countSpan.textContent = articulosSeleccionadosReporte.length;
    } else {
        container.style.display = 'none';
    }
}

// Abrir modal de reportar problemas múltiples
function abrirReportarProblemasMultiples() {
    if (articulosSeleccionadosReporte.length === 0) {
        Swal.fire('Error', 'No hay artículos seleccionados', 'error');
        return;
    }
    
    console.log('📋 Artículos seleccionados:', articulosSeleccionadosReporte.length);
    
    // Actualizar contador
    document.getElementById('count-articulos-problema').textContent = articulosSeleccionadosReporte.length;
    
    // Renderizar lista de artículos
    renderListaArticulosProblemas();
    
    // ESPERAR UN MOMENTO PARA QUE SE RENDERICE EL DOM
    setTimeout(() => {
        console.log('✅ DOM renderizado, abriendo modal...');
        openModal('reportarProblemasMultiplesModal');
    }, 100);
}

// Renderizar lista de artículos con problemas en el modal
// Renderizar lista de artículos con problemas en el modal
function renderListaArticulosProblemas() {
    const container = document.getElementById('lista-articulos-problemas');
    
    container.innerHTML = articulosSeleccionadosReporte.map((articulo, index) => `
        <div class="problema-card" data-articulo-index="${index}">
            <div class="problema-card-header">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                        <span style="background: #EF4444; color: white; padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">
                            ${articulo.codigo}
                        </span>
                        <strong style="font-size: 1.1rem; color: #111827;">${articulo.nombre}</strong>
                    </div>
                    <div style="color: #6B7280; font-size: 0.9rem;">
                        <span>Stock Evento: <strong>${articulo.cantidad_evento}</strong></span> | 
                        <span>Precio: <strong>Q${parseFloat(articulo.precio_unitario).toFixed(2)}</strong></span>
                    </div>
                </div>
                <div class="subtotal-badge" id="subtotal-${index}">
                    Q0.00
                </div>
            </div>
            
            <div class="problema-card-body">
                <!-- Tipo de Problema -->
                <div class="problema-field">
                    <label>
                        Tipo de Problema <span class="required">*</span>
                    </label>
                    <select 
                        class="form-control problema-select" 
                        id="tipo-problema-${index}"
                        onchange="validarCampoProblema(${index}, 'tipo')"
                        required>
                        <option value="">Seleccionar...</option>
                        <option value="roto">Roto</option>
                        <option value="perdido">Pérdido</option>
                        <option value="dañado">Dañado</option>
                        <option value="faltante">Faltante</option>
                        <option value="equivocado">Equivocado</option>
                    </select>
                    <div class="error-message" id="error-tipo-${index}" style="display: none;">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>Debe seleccionar un tipo de problema</span>
                    </div>
                </div>
                
                <!-- Cantidad Afectada -->
                <div class="problema-field">
                    <label>
                        Cantidad Afectada <span class="required">*</span>
                    </label>
                    <div class="cantidad-controls">
                        <button type="button" class="cantidad-btn" onclick="cambiarCantidadProblema(${index}, -1)">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input 
                            type="number" 
                            class="cantidad-input" 
                            id="cantidad-problema-${index}"
                            value="1"
                            min="1"
                            max="${articulo.cantidad_evento}"
                            onchange="validarCantidadProblema(${index})"
                            oninput="validarCantidadProblema(${index})">
                        <button type="button" class="cantidad-btn" onclick="cambiarCantidadProblema(${index}, 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="help-text">(Máximo: ${articulo.cantidad_evento})</div>
                    <div class="error-message" id="error-cantidad-${index}" style="display: none;">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>La cantidad no puede exceder ${articulo.cantidad_evento}</span>
                    </div>
                </div>
                
                <!-- Responsable -->
                <div class="problema-field">
                    <label>
                        Responsable <span class="required">*</span>
                    </label>
                    <select 
                        class="form-control problema-select" 
                        id="responsable-problema-${index}"
                        onchange="validarCampoProblema(${index}, 'responsable')"
                        required>
                        <option value="">Seleccionar...</option>
                        <option value="cliente">Cliente</option>
                        <option value="empresa">Empresa</option>
                        <option value="proveedor">Proveedor Externo</option>
                    </select>
                    <div class="error-message" id="error-responsable-${index}" style="display: none;">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>Debe seleccionar un responsable</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // ESPERAR A QUE EL DOM SE RENDERICE ANTES DE CALCULAR
    setTimeout(() => {
        console.log('🎨 Calculando costos iniciales...');
        calcularCostoTotalProblemas();
    }, 50);
}

// Cambiar cantidad con botones +/-
function cambiarCantidadProblema(index, delta) {
    const input = document.getElementById(`cantidad-problema-${index}`);
    const articulo = articulosSeleccionadosReporte[index];
    let newValue = parseInt(input.value) + delta;
    
    // Validar rango
    if (newValue < 1) newValue = 1;
    if (newValue > articulo.cantidad_evento) newValue = articulo.cantidad_evento;
    
    input.value = newValue;
    validarCantidadProblema(index);
}

// Validar cantidad
function validarCantidadProblema(index) {
    const input = document.getElementById(`cantidad-problema-${index}`);
    const errorDiv = document.getElementById(`error-cantidad-${index}`);
    const articulo = articulosSeleccionadosReporte[index];
    
    let cantidad = parseInt(input.value);
    
    // Validar que sea número entero
    if (isNaN(cantidad) || !Number.isInteger(cantidad)) {
        cantidad = 1;
        input.value = 1;
    }
    
    // Validar rango
    if (cantidad < 1) {
        cantidad = 1;
        input.value = 1;
    }
    
    if (cantidad > articulo.cantidad_evento) {
        input.classList.add('error');
        errorDiv.style.display = 'flex';
        return false;
    } else {
        input.classList.remove('error');
        errorDiv.style.display = 'none';
    }
    
    // Actualizar subtotal
    actualizarSubtotalProblema(index);
    
    return true;
}

// Validar campos de select
function validarCampoProblema(index, campo) {
    const select = document.getElementById(`${campo === 'tipo' ? 'tipo' : 'responsable'}-problema-${index}`);
    const errorDiv = document.getElementById(`error-${campo}-${index}`);
    
    if (!select.value) {
        select.classList.add('error');
        errorDiv.style.display = 'flex';
        return false;
    } else {
        select.classList.remove('error');
        errorDiv.style.display = 'none';
        return true;
    }
}

// Actualizar subtotal de un artículo
// Actualizar subtotal de un artículo
function actualizarSubtotalProblema(index) {
    const articulo = articulosSeleccionadosReporte[index];
    const cantidadElem = document.getElementById(`cantidad-problema-${index}`);
    
    if (!cantidadElem) {
        console.warn(`⚠️ Elemento cantidad-problema-${index} no encontrado`);
        return;
    }
    
    const cantidad = parseInt(cantidadElem.value) || 0;
    const subtotal = cantidad * articulo.precio_unitario;
    
    const subtotalElem = document.getElementById(`subtotal-${index}`);
    if (subtotalElem) {
        subtotalElem.textContent = `Q${subtotal.toFixed(2)}`;
    }
    
    // Recalcular total
    calcularCostoTotalProblemas();
}

// Calcular costo total de todos los problemas
function calcularCostoTotalProblemas() {
    let total = 0;
    
    articulosSeleccionadosReporte.forEach((articulo, index) => {
        const cantidadElem = document.getElementById(`cantidad-problema-${index}`);
        
        // Verificar que el elemento existe antes de leerlo
        if (cantidadElem) {
            const cantidad = parseInt(cantidadElem.value) || 0;
            total += cantidad * articulo.precio_unitario;
        } else {
            console.warn(`⚠️ Elemento cantidad-problema-${index} no encontrado aún`);
        }
    });
    
    const totalElem = document.getElementById('costo-total-problemas');
    if (totalElem) {
        totalElem.textContent = `Q${total.toFixed(2)}`;
    }
}

// Validar todos los campos antes de guardar
function validarTodosLosCampos() {
    let isValid = true;
    let errors = [];
    
    // PRIMERO: Verificar que los elementos existen
    console.log('🔍 Iniciando validación de campos...');
    console.log('Artículos a validar:', articulosSeleccionadosReporte.length);
    
    articulosSeleccionadosReporte.forEach((articulo, index) => {
        console.log(`Validando artículo ${index}: ${articulo.nombre}`);
        
        // Obtener elementos
        const tipoElem = document.getElementById(`tipo-problema-${index}`);
        const cantidadElem = document.getElementById(`cantidad-problema-${index}`);
        const responsableElem = document.getElementById(`responsable-problema-${index}`);
        
        // Verificar que existen
        if (!tipoElem) {
            console.error(`❌ No se encontró: tipo-problema-${index}`);
            errors.push(`${articulo.nombre}: Error del sistema - elemento tipo no encontrado`);
            isValid = false;
            return;
        }
        
        if (!cantidadElem) {
            console.error(`❌ No se encontró: cantidad-problema-${index}`);
            errors.push(`${articulo.nombre}: Error del sistema - elemento cantidad no encontrado`);
            isValid = false;
            return;
        }
        
        if (!responsableElem) {
            console.error(`❌ No se encontró: responsable-problema-${index}`);
            errors.push(`${articulo.nombre}: Error del sistema - elemento responsable no encontrado`);
            isValid = false;
            return;
        }
        
        // Validar tipo de problema
        if (!tipoElem.value || tipoElem.value === '') {
            isValid = false;
            errors.push(`${articulo.nombre}: Debe seleccionar un tipo de problema`);
        }
        
        // Validar cantidad
        const cantidad = parseInt(cantidadElem.value);
        if (isNaN(cantidad) || cantidad <= 0 || cantidad > articulo.cantidad_evento) {
            isValid = false;
            errors.push(`${articulo.nombre}: La cantidad es inválida`);
        }
        
        // Validar responsable
        if (!responsableElem.value || responsableElem.value === '') {
            isValid = false;
            errors.push(`${articulo.nombre}: Debe seleccionar un responsable`);
        }
    });
    
    console.log('Resultado validación:', { isValid, errorsCount: errors.length });
    
    return { isValid, errors };
}

async function guardarProblemasMultiples() {
    // Validar todos los campos
    const validacion = validarTodosLosCampos();
    
    if (!validacion.isValid) {
        Swal.fire({
            icon: 'error',
            title: 'Campos Incompletos',
            html: '<div style="text-align: left;"><strong>Por favor complete:</strong><ul style="margin-top: 0.5rem;">' + 
                  validacion.errors.map(e => `<li>${e}</li>`).join('') + 
                  '</ul></div>'
        });
        return;
    }
    
    console.log('🔍 Verificando elementos del formulario...');
    
    // Preparar datos para enviar CON VALIDACIÓN
    const problemas = [];

    for (let index = 0; index < articulosSeleccionadosReporte.length; index++) {
        const articulo = articulosSeleccionadosReporte[index];
        
        const tipoElem = document.getElementById(`tipo-problema-${index}`);
        const cantidadElem = document.getElementById(`cantidad-problema-${index}`);
        const responsableElem = document.getElementById(`responsable-problema-${index}`);
        
        if (!tipoElem || !cantidadElem || !responsableElem) {
            console.error(`Error: Elementos no encontrados para índice ${index}`);
            Swal.fire('Error', 'Error al leer el formulario. Intenta nuevamente.', 'error');
            return;
        }
        
        problemas.push({
            id_detalle: articulo.id_detalle,
            id_articulo: articulo.id_articulo,
            tipo_problema: tipoElem.value,
            cantidad_afectada: parseInt(cantidadElem.value),
            responsable: responsableElem.value,
            costo_unitario: articulo.precio_unitario
        });
    }

    console.log('✅ Problemas preparados:', problemas);

    // Calcular costo total
    const costoTotal = problemas.reduce((sum, p) => sum + (p.cantidad_afectada * p.costo_unitario), 0);
    
    try {
        Swal.fire({
            title: 'Guardando...',
            text: 'Registrando problemas y generando PDF',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const response = await fetch(`/api/eventos/${eventoGestionActual.id_evento}/reportar-problemas-lote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                problemas: problemas,
                costo_total: costoTotal
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
                closeReportarProblemasMultiples();
                    articulosSeleccionadosReporte = [];
                    
                    // AGREGAR: Recargar artículos del evento desde el servidor
                    try {
                        const response = await fetch(`/api/eventos/${eventoGestionActual.id_evento}/articulos`);
                        const articleData = await response.json();
                        
                        if (articleData.success) {
                            articulosGestionActual = articleData.articulos;
                            renderArticulosGestion(); // Re-renderizar la tabla
                        }
                    } catch (error) {
                        console.error('Error recargando artículos:', error);
                    }
            
            if (data.pdf_url) {
                const link = document.createElement('a');
                link.href = data.pdf_url;
                link.download = `reporte-problemas-${eventoGestionActual.numero_evento}.pdf`;
                link.click();
            }
            
            Swal.fire({
                icon: 'success',
                title: 'Problemas Registrados',
                html: `
                    <div style="text-align: left;">
                        <p><strong>${data.reportes_creados}</strong> problemas registrados correctamente</p>
                        <p>Costo total: <strong>Q${data.costo_total.toFixed(2)}</strong></p>
                        <p style="color: #059669; margin-top: 1rem;">
                            <i class="fas fa-check-circle"></i> PDF descargado automáticamente
                        </p>
                    </div>
                `,
                confirmButtonText: 'Entendido'
            });
        } else {
            Swal.fire('Error', data.message || 'Error al guardar los problemas', 'error');
        }
    } catch (error) {
        console.error('Error guardando problemas:', error);
        Swal.fire('Error', 'Error al guardar los problemas', 'error');
    }
}


// Cerrar modal de problemas múltiples
function closeReportarProblemasMultiples() {
    const hasData = articulosSeleccionadosReporte.length > 0;
    
    if (hasData) {
        Swal.fire({
            title: '¿Está seguro?',
            text: 'Perderá los cambios no guardados',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                closeModal('reportarProblemasMultiplesModal');
            }
        });
    } else {
        closeModal('reportarProblemasMultiplesModal');
    }
}

// ===============================================
// FIN SISTEMA DE REPORTE DE PROBLEMAS MÚLTIPLES
// ===============================================


// Actualizar estado global de todos los artículos
async function actualizarEstadoGlobal() {
    const estadoGlobal = document.getElementById('estado-global-articulos').value;
    
    if (!estadoGlobal) {
        Swal.fire('Error', 'Por favor seleccione un estado', 'warning');
        return;
    }
    
    const eventoId = eventoGestionActual?.id_evento;
    
    if (!eventoId) {
        Swal.fire('Error', 'No se pudo determinar el evento', 'error');
        return;
    }
    
    const descripciones = {
        'reservado': 'Los artículos estarán reservados para el evento',
        'entregado': 'Los artículos serán entregados al cliente (se descuenta del stock)',
        'recogido': 'Los artículos serán recogidos del cliente (se regresa al stock)'
    };
    
    const confirmacion = await Swal.fire({
        title: '¿Actualizar todos los artículos?',
        html: `
            <div style="text-align: left;">
                <p>Se cambiará el estado de <strong>TODOS</strong> los artículos a: <strong>${estadoGlobal.toUpperCase()}</strong></p>
                <p class="text-muted" style="font-size: 0.9rem; margin-top: 0.5rem;">
                    ${descripciones[estadoGlobal]}
                </p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, actualizar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563EB'
    });
    
    if (!confirmacion.isConfirmed) return;
    
    try {
        Swal.fire({
            title: 'Actualizando...',
            text: 'Por favor espere',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        
        const response = await fetch(`/api/eventos/${eventoId}/articulos/estado-global`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                estado: estadoGlobal
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Estado Actualizado',
                text: `Todos los artículos han sido marcados como ${estadoGlobal}`,
                timer: 2000
            });
            
            // Recargar artículos
            abrirGestionArticulosEvento(eventoId);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error actualizando estado global:', error);
        Swal.fire('Error', error.message || 'Error al actualizar el estado', 'error');
    }
}

// Cargar registro de estados con fechas
async function cargarRegistroEstados() {
    try {
        const eventoId = eventoGestionActual?.id_evento;
        
        if (!eventoId) return;
        
        const response = await fetch(`/api/eventos/${eventoId}/estados-registro`);
        const data = await response.json();
        
        if (data.success && data.estados) {
            // Zona horaria de Guatemala (GMT-6)
            const formatearFechaGuatemala = (fecha) => {
                if (!fecha) return 'Sin registro';
                const d = new Date(fecha);
                // Convertir a zona horaria de Guatemala
                const opciones = {
                    timeZone: 'America/Guatemala',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                };
                return new Intl.DateTimeFormat('es-GT', opciones).format(d);
            };
            
            document.querySelector('#estado-reservado-registro span').textContent = 
                formatearFechaGuatemala(data.estados.reservado);
            document.querySelector('#estado-entregado-registro span').textContent = 
                formatearFechaGuatemala(data.estados.entregado);
            document.querySelector('#estado-recogido-registro span').textContent = 
                formatearFechaGuatemala(data.estados.recogido);
        }
    } catch (error) {
        console.error('Error cargando registro de estados:', error);
    }
}


    function verDetalleArticuloEvento(detalleId) {
        const articulo = articulosGestionActual.find(a => a.id_detalle === detalleId);
        if (!articulo) return;

        Swal.fire({
            title: articulo.nombre_articulo,
            html: `
                <div style="text-align: left;">
                    <p><strong>Código:</strong> ${articulo.codigo}</p>
                    <p><strong>Cantidad Solicitada:</strong> ${articulo.cantidad_solicitada}</p>
                    <p><strong>Cantidad Entregada:</strong> ${articulo.cantidad_entregada || 0}</p>
                    <p><strong>Cantidad Recogida:</strong> ${articulo.cantidad_recogida || 0}</p>
                    <p><strong>Cantidad Dañada:</strong> ${articulo.cantidad_dañada || 0}</p>
                    <p><strong>Cantidad Perdida:</strong> ${articulo.cantidad_perdida || 0}</p>
                    <p><strong>Estado:</strong> ${articulo.estado_articulo}</p>
                    <p><strong>Precio Unitario:</strong> Q${articulo.precio_unitario.toFixed(2)}</p>
                    ${articulo.notas ? `<p><strong>Notas:</strong> ${articulo.notas}</p>` : ''}
                </div>
            `,
            width: '600px',
            confirmButtonText: 'Cerrar'
        });
    }



       // ===============================================
    // FORMULARIO DE REPORTES
    // ===============================================

    async function mostrarBotonEscribirProblema() {
        // Verificar si hay artículos con problemas
        const articulosConProblemas = articulosGestionActual.filter(a => a.estado_articulo === 'con_problemas');
        
        const footer = document.querySelector('#gestionArticulosEventoModal .modal-footer');
        
        // Limpiar botones anteriores
        const botonExistente = document.getElementById('btn-escribir-problemas');
        if (botonExistente) {
            botonExistente.remove();
        }
        
        if (articulosConProblemas.length > 0) {
            const boton = document.createElement('button');
            boton.id = 'btn-escribir-problemas';
            boton.className = 'btn btn-danger';
            boton.style.marginRight = 'auto';
            boton.innerHTML = '<i class="fas fa-exclamation-circle"></i> Escribe el problema';
            boton.onclick = () => abrirModalProblemasMultiples(eventoGestionActual.id_evento);
            
            footer.insertBefore(boton, footer.firstChild);
        }
    }

    async function abrirModalProblemasMultiples(eventoId) {
        try {
            Swal.fire({
                title: 'Cargando...',
                text: 'Obteniendo artículos con problemas',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            const response = await fetch(`/api/eventos/${eventoId}/articulos-con-problemas`);
            const data = await response.json();
            
            if (data.success && data.articulos.length > 0) {
                document.getElementById('problemas-evento-id').value = eventoId;
                renderArticulosProblemas(data.articulos);
                Swal.close();
                openModal('reportarProblemasModal');
            } else {
                Swal.fire('Información', 'No hay artículos con problemas en este evento', 'info');
            }
            
        } catch (error) {
            console.error('Error cargando artículos con problemas:', error);
            Swal.fire('Error', 'Error al cargar artículos', 'error');
        }
    }

    function renderArticulosProblemas(articulos) {
    const container = document.getElementById('articulos-problemas-container');
    
    container.innerHTML = `
        <div class="table-container" style="background: white; border-radius: 12px; overflow: hidden;">
            <table class="table" style="margin: 0;">
                <thead>
                    <tr style="background: linear-gradient(135deg, #EF4444, #DC2626);">
                        <th style="color: white;">Código</th>
                        <th style="color: white;">Artículo</th>
                        <th style="color: white;">Cantidad</th>
                        <th style="color: white;">Precio Unit.</th>
                        <th style="color: white;">Tipo Problema *</th>
                        <th style="color: white;">Responsable</th>
                        <th style="color: white;">Costo Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${articulos.map((articulo, index) => {
                        const costoTotal = (articulo.precio_unitario * articulo.cantidad).toFixed(2);
                        return `
                            <tr style="background: ${index % 2 === 0 ? '#FEF2F2' : '#FFFFFF'};">
                                <td style="font-weight: 600;">
                                    <code style="background: #DC2626; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                                        ${articulo.codigo}
                                    </code>
                                </td>
                                <td>
                                    <strong>${articulo.nombre_articulo}</strong>
                                    <input type="hidden" id="problema-detalle-${index}" value="${articulo.id_detalle}">
                                    <input type="hidden" id="problema-articulo-${index}" value="${articulo.id_articulo}">
                                    <input type="hidden" id="problema-precio-${index}" value="${articulo.precio_unitario}">
                                </td>
                                <td>
                                    <span style="background: #EF4444; color: white; padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; display: inline-block;">
                                        ${articulo.cantidad}
                                    </span>
                                </td>
                                <td style="font-weight: 600; color: #059669;">
                                    Q${parseFloat(articulo.precio_unitario).toFixed(2)}
                                </td>
                                <td>
                                    <select class="form-control" id="problema-tipo-${index}" required 
                                            style="padding: 0.5rem; font-size: 0.9rem; border: 2px solid #DC2626;">
                                        <option value="">Seleccionar...</option>
                                        <option value="roto">Roto</option>
                                        <option value="perdido">Perdido</option>
                                    </select>
                                </td>
                                <td>
                                    <select class="form-control" id="problema-responsable-${index}"
                                            style="padding: 0.5rem; font-size: 0.9rem;">
                                        <option value="Cliente">Cliente</option>
                                        <option value="Empresa">Empresa</option>
                                        <option value="Tercero">Tercero</option>
                                        <option value="Desconocido">Desconocido</option>
                                    </select>
                                </td>
                                <td style="font-weight: 700; color: #DC2626; font-size: 1.1rem;">
                                    Q${costoTotal}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: linear-gradient(135deg, #FEE2E2, #FECACA); border-top: 3px solid #DC2626;">
                        <td colspan="6" style="text-align: right; font-weight: 700; font-size: 1.1rem; padding: 1rem;">
                            COSTO TOTAL DE PROBLEMAS:
                        </td>
                        <td style="font-weight: 700; color: #DC2626; font-size: 1.3rem; padding: 1rem;">
                            Q${articulos.reduce((sum, a) => sum + (a.precio_unitario * a.cantidad), 0).toFixed(2)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 1rem; border-radius: 8px; margin-top: 1.5rem;">
            <p style="margin: 0; color: #92400E; font-size: 0.9rem;">
                <i class="fas fa-info-circle"></i> 
                <strong>Nota:</strong> Complete el tipo de problema y responsable para cada artículo. 
                Los costos se calculan automáticamente según el precio de alquiler.
            </p>
        </div>
    `;
}
