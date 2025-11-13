
    // ===============================================
    // GESTIÓN DE COTIZACIONES
    // ===============================================

    async function loadCotizaciones() {
        try {
            const response = await fetch('/api/cotizaciones');
            const data = await response.json();
            
            if (data.success) {
                cotizacionesData = data.cotizaciones;
                allCotizaciones = data.cotizaciones || [];
                
                pagination_cotizaciones.init(allCotizaciones, (items) => {
                    renderCotizacionesPage(items);
                });
            }
        } catch (error) {
            console.error('Error loading cotizaciones:', error);
            const tbody = document.getElementById('cotizaciones-table-body');
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Error al cargar cotizaciones</td></tr>';
        }
    }

    function renderCotizacionesPage(cotizaciones) {
        const tbody = document.getElementById('cotizaciones-table-body');
        
        if (cotizaciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay cotizaciones en esta página</td></tr>';
            return;
        }
        
        tbody.classList.add('table-animated');
        setTimeout(() => tbody.classList.remove('table-animated'), 300);
        
        tbody.innerHTML = cotizaciones.map(cotizacion => `
            <tr>
                <td><strong>${cotizacion.numero_cotizacion}</strong></td>
                <td>${cotizacion.cliente_nombre || '<em>Sin cliente definido</em>'}</td>
                <td>${formatDate(cotizacion.fecha_evento)}</td>
                <td>Q${parseFloat(cotizacion.monto_total || 0).toFixed(2)}</td>
                <td><span class="status-badge status-${cotizacion.estado}">${cotizacion.estado}</span></td>
                <td>
                    <button class="btn btn-icon btn-view" onclick="verDetalleCotizacion(${cotizacion.id_cotizacion})" title="Ver">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-success btn-sm" onclick="descargarCotizacionPDF(${cotizacion.id_cotizacion})" title="Descargar PDF">
                        <i class="fas fa-download"></i>
                    </button>
                    ${cotizacion.estado === 'enviada' || cotizacion.estado === 'borrador' ? `
                        <button class="btn btn-icon btn-edit" onclick="abrirEdicionCotizacion(${cotizacion.id_cotizacion})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-info btn-sm" onclick="aprobarCotizacion(${cotizacion.id_cotizacion})" title="Aprobar">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    ${cotizacion.estado === 'borrador' || cotizacion.estado === 'rechazada' ? `
                        <button class="btn btn-danger btn-sm" onclick="eliminarCotizacion(${cotizacion.id_cotizacion})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    // Función para actualizar cotización
    async function actualizarCotizacion(cotizacionId) {
        const cotizacionData = {
            id_cliente: document.getElementById('cotizacion-cliente').value || null,
            fecha_evento: document.getElementById('cotizacion-fecha').value,
            hora_inicio: document.getElementById('cotizacion-hora-inicio').value,
            hora_fin: document.getElementById('cotizacion-hora-fin').value,
            lugar_evento: document.getElementById('cotizacion-lugar').value,
            numero_invitados: document.getElementById('cotizacion-invitados').value ? parseInt(document.getElementById('cotizacion-invitados').value) : null,
            notas: document.getElementById('cotizacion-notas').value,
            monto_total: parseFloat(document.getElementById('cart-total-cot').textContent),
            articulos: cotizacionCart.filter(item => item.tipo === 'articulo').map(item => ({
                id_articulo: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            })),
            servicios: cotizacionCart.filter(item => item.tipo === 'servicio').map(item => ({
                id_servicio: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            }))
        };
        
        try {
            const response = await fetch(`/api/cotizaciones/${cotizacionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cotizacionData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                Swal.fire('Éxito', 'Cotización actualizada correctamente', 'success');
                closeModal('cotizacionModal');
                
                // Resetear el botón
                const saveButton = document.querySelector('#cotizacionModal .modal-footer .btn-primary');
                saveButton.innerHTML = '<i class="fas fa-save"></i> Guardar Cotización';
                saveButton.onclick = guardarCotizacionCompleta;
                
                cotizacionCart = [];
                cotizacionActualId = null;
                renderCotizacionCart();
                
                loadCotizaciones();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error actualizando cotización:', error);
            Swal.fire('Error', 'Error al actualizar cotización', 'error');
        }
    }

    // Función para eliminar cotización (solo borradores y rechazadas)
    async function eliminarCotizacion(cotizacionId) {
        const result = await Swal.fire({
            title: '¿Eliminar cotización?',
            html: `
                <div style="text-align: left;">
                    <p>Esta acción eliminará permanentemente la cotización.</p>
                    <p class="text-muted" style="font-size: 0.9rem; margin-top: 0.5rem;">
                        Solo se pueden eliminar cotizaciones en estado "borrador" o "rechazada".
                    </p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#EF4444'
        });

        if (result.isConfirmed) {
            try {
                // NOTA: La eliminación solo borrará el registro de cotización
                // NO afectará artículos ni otros datos del sistema
                const response = await fetch(`/api/cotizaciones/${cotizacionId}`, { 
                    method: 'DELETE' 
                });
                const data = await response.json();
                
                if (data.success) {
                    Swal.fire('Eliminado', 'Cotización eliminada correctamente', 'success');
                    loadCotizaciones();
                } else {
                    Swal.fire('Error', data.message, 'error');
                }
            } catch (error) {
                console.error('Error eliminando cotización:', error);
                Swal.fire('Error', 'Error al eliminar cotización', 'error');
            }
        }
    }

    function aprobarCotizacion(cotizacionId) {
        aprobarCotizacionDirecta(cotizacionId);
    }

    function toggleCotizacionSection(sectionId) {
        const section = document.getElementById(sectionId);
        const isVisible = !section.classList.contains('hidden');
        
        if (isVisible) {
            section.classList.add('hidden');
        } else {
            section.classList.remove('hidden');
            
            if (sectionId === 'articulos-section-cot' && articulosDisponibles.length === 0) {
                loadArticulosParaCotizacion();
            } else if (sectionId === 'servicios-section-cot' && serviciosDisponibles.length === 0) {
                loadServiciosParaCotizacion();
            }
        }
    }

    async function loadArticulosParaCotizacion() {
        try {
            const response = await fetch('/api/articulos');
            const data = await response.json();
            
            if (data.success) {
                articulosDisponibles = data.articulos;
                renderArticulosGridCotizacion();
            }
        } catch (error) {
            console.error('Error loading artículos:', error);
        }
    }

    async function loadServiciosParaCotizacion() {
        try {
            const response = await fetch('/api/servicios');
            const data = await response.json();
            
            if (data.success) {
                serviciosDisponibles = data.servicios;
                renderServiciosGridCotizacion();
            }
        } catch (error) {
            console.error('Error loading servicios:', error);
        }
    }

    function renderArticulosGridCotizacion() {
        const grid = document.getElementById('articulos-grid-cot');
        
        if (articulosDisponibles.length === 0) {
            grid.innerHTML = '<p class="text-muted">No hay artículos disponibles</p>';
            return;
        }
        
        grid.innerHTML = articulosDisponibles.map(articulo => `
            <div class="item-card" onclick="addItemToCotizacionCart('articulo', ${articulo.id_articulo})">
                <h5>${articulo.nombre_articulo}</h5>
                <div class="price">Q${parseFloat(articulo.precio_unitario).toFixed(2)}</div>
                <div class="stock">Stock: ${articulo.cantidad_disponible}</div>
            </div>
        `).join('');
    }

    function renderServiciosGridCotizacion() {
        const grid = document.getElementById('servicios-grid-cot');
        
        if (serviciosDisponibles.length === 0) {
            grid.innerHTML = '<p class="text-muted">No hay servicios disponibles</p>';
            return;
        }
        
        grid.innerHTML = serviciosDisponibles.map(servicio => `
            <div class="item-card" onclick="addItemToCotizacionCart('servicio', ${servicio.id_servicio})">
                <h5>${servicio.nombre_servicio}</h5>
                <div class="price">Q${parseFloat(servicio.precio_fijo || servicio.precio_por_hora).toFixed(2)}</div>
                <div class="stock">${servicio.categoria}</div>
            </div>
        `).join('');
    }

    function addItemToCotizacionCart(tipo, id) {
        let item;
        
        if (tipo === 'articulo') {
            item = articulosDisponibles.find(a => a.id_articulo === id);
            if (!item) return;
            
            const existing = cotizacionCart.find(c => c.tipo === 'articulo' && c.id === id);
            if (existing) {
                existing.cantidad++;
            } else {
                cotizacionCart.push({
                    tipo: 'articulo',
                    id: item.id_articulo,
                    nombre: item.nombre_articulo,
                    precio: parseFloat(item.precio_unitario),
                    cantidad: 1
                });
            }
        } else if (tipo === 'servicio') {
            item = serviciosDisponibles.find(s => s.id_servicio === id);
            if (!item) return;
            
            const existing = cotizacionCart.find(c => c.tipo === 'servicio' && c.id === id);
            if (existing) {
                existing.cantidad++;
            } else {
                cotizacionCart.push({
                    tipo: 'servicio',
                    id: item.id_servicio,
                    nombre: item.nombre_servicio,
                    precio: parseFloat(item.precio_fijo || item.precio_por_hora),
                    cantidad: 1
                });
            }
        }
        
        renderCotizacionCart();
    }

    function renderCotizacionCart() {
        const tbody = document.getElementById('cart-body-cot');
        
        if (cotizacionCart.length === 0) {
            tbody.innerHTML = '<tr class="empty-cart"><td colspan="5" class="text-center text-muted">No hay elementos en la cotización</td></tr>';
            document.getElementById('cart-total-cot').textContent = '0.00';
            return;
        }
        
        let total = 0;
        
        tbody.innerHTML = cotizacionCart.map((item, index) => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;
            
            return `
                <tr>
                    <td>
                        <strong>${item.nombre}</strong>
                        <br><small class="text-muted">${item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}</small>
                    </td>
                    <td>Q${item.precio.toFixed(2)}</td>
                    <td>
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="changeCotizacionCartQuantity(${index}, -1)">-</button>
                            <input type="number" class="qty-input" value="${item.cantidad}" min="1" onchange="setCartQuantity(${index}, this.value)">
                            <button class="qty-btn" onclick="changeCotizacionCartQuantity(${index}, 1)">+</button>
                        </div>
                    </td>
                    <td>Q${subtotal.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="removeFromCotizacionCart(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('cart-total-cot').textContent = total.toFixed(2);
    }

    function changeCotizacionCartQuantity(index, delta) {
        const item = cotizacionCart[index];
        item.cantidad += delta;
        
        if (item.cantidad <= 0) {
            cotizacionCart.splice(index, 1);
        }
        
        renderCotizacionCart();
    }

    function removeFromCotizacionCart(index) {
        cotizacionCart.splice(index, 1);
        renderCotizacionCart();
    }

    async function guardarCotizacionCompleta() {
        const cotizacionData = {
            id_cliente: document.getElementById('cotizacion-cliente').value || null,
            fecha_evento: document.getElementById('cotizacion-fecha').value,
            hora_inicio: document.getElementById('cotizacion-hora-inicio').value,
            hora_fin: document.getElementById('cotizacion-hora-fin').value,
            lugar_evento: document.getElementById('cotizacion-lugar').value,
            numero_invitados: document.getElementById('cotizacion-invitados').value ? parseInt(document.getElementById('cotizacion-invitados').value) : null,
            notas: document.getElementById('cotizacion-notas').value,
            monto_total: parseFloat(document.getElementById('cart-total-cot').textContent),
            articulos: cotizacionCart.filter(item => item.tipo === 'articulo').map(item => ({
                id_articulo: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            })),
            servicios: cotizacionCart.filter(item => item.tipo === 'servicio').map(item => ({
                id_servicio: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            }))
        };
        
        try {
            const response = await fetch('/api/cotizaciones/completa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cotizacionData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                cotizacionActualId = data.cotizacion_id;
                
                Swal.fire({
                    title: 'Cotización Guardada',
                    html: `
                        <p>Cotización <strong>${data.numero_cotizacion}</strong> creada exitosamente</p>
                        <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;">
                            <button class="btn btn-primary" onclick="descargarCotizacionPDF(${data.cotizacion_id})">
                                <i class="fas fa-download"></i> Descargar PDF
                            </button>
                            <button class="btn btn-success" onclick="aprobarCotizacionDirecta(${data.cotizacion_id})">
                                <i class="fas fa-check"></i> Aprobar y Crear Evento
                            </button>
                        </div>
                    `,
                    icon: 'success',
                    showConfirmButton: false,
                    showCloseButton: true
                });
                
                closeModal('cotizacionModal');
                
                cotizacionCart = [];
                renderCotizacionCart();
                
                loadCotizaciones();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error guardando cotización:', error);
            Swal.fire('Error', 'Error al guardar cotización', 'error');
        }
    }

    function descargarCotizacionPDF(cotizacionId) {
        window.open(`/api/cotizaciones/${cotizacionId}/pdf`, '_blank');
        Swal.close();
    }

async function aprobarCotizacionDirecta(cotizacionId) {
    try {
        // Aprobar directamente sin modal
        const approveResponse = await fetch(`/api/cotizaciones/${cotizacionId}/aprobar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})  // Body vacío, el backend usa el cliente de la cotización
        });
        
        const approveData = await approveResponse.json();
        
        if (approveData.success) {
            // Mensaje simple con check
            Swal.fire({
                icon: 'success',
                title: '✓ Cotización agregada a evento',
                text: `Evento ${approveData.numero_evento} creado exitosamente`,
                timer: 3000,
                showConfirmButton: false
            });
            loadCotizaciones();
            loadEventos();
        } else {
            Swal.fire('Error', approveData.message, 'error');
        }
    } catch (error) {
        console.error('Error aprobando cotización:', error);
        Swal.fire('Error', 'Error al aprobar cotización', 'error');
    }
}


    // Búsqueda y filtros de cotizaciones
    document.getElementById('search-cotizaciones')?.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        aplicarFiltrosCotizaciones();
    });

    document.getElementById('filter-estado-cotizacion')?.addEventListener('change', function(e) {
        aplicarFiltrosCotizaciones();
    });

    async function aplicarFiltrosCotizaciones() {
        const searchTerm = document.getElementById('search-cotizaciones').value.toLowerCase();
        const estadoFiltro = document.getElementById('filter-estado-cotizacion').value;
        
        try {
            const response = await fetch('/api/cotizaciones');
            const data = await response.json();
            
            if (data.success) {
                let filteredCotizaciones = data.cotizaciones;
                
                // Filtro por estado
                if (estadoFiltro) {
                    filteredCotizaciones = filteredCotizaciones.filter(c => c.estado === estadoFiltro);
                }
                
                // Filtro por búsqueda
                if (searchTerm) {
                    filteredCotizaciones = filteredCotizaciones.filter(c => 
                        (c.numero_cotizacion && c.numero_cotizacion.toLowerCase().includes(searchTerm)) ||
                        (c.cliente_nombre && c.cliente_nombre.toLowerCase().includes(searchTerm)) ||
                        (c.lugar_evento && c.lugar_evento.toLowerCase().includes(searchTerm))
                    );
                }
                
                renderCotizacionesPage(filteredCotizaciones);
            }
        } catch (error) {
            console.error('Error aplicando filtros:', error);
        }
    }


    

    // ─────────────────── EDITAR COTIZACIÓN ───────────────────

    async function abrirEdicionCotizacion(idCotizacion) {
        try {
            idCotizacionEditar = idCotizacion;
            
            const response = await fetch(`/api/cotizaciones/${idCotizacion}`);
            const data = await response.json();
            
            if (!data.success) {
                Swal.fire('Error', 'No se pudo cargar la cotización', 'error');
                return;
            }
            
            const cotizacion = data.cotizacion;
            
            await cargarClientesParaEditarCot();
            
            if (cotizacion.id_cliente) {
                document.querySelector('input[name="edit-cot-cliente-tipo"][value="existente"]').checked = true;
                toggleEditCotClienteForm('existente');
                document.getElementById('edit-cot-cliente').value = cotizacion.id_cliente;
            } else {
                document.querySelector('input[name="edit-cot-cliente-tipo"][value="nuevo"]').checked = true;
                toggleEditCotClienteForm('nuevo');
                document.getElementById('edit-cot-nuevo-cliente-nombre').value = cotizacion.nombre_cliente || '';
                document.getElementById('edit-cot-nuevo-cliente-telefono').value = cotizacion.telefono_cliente || '';
                document.getElementById('edit-cot-nuevo-cliente-direccion').value = cotizacion.direccion_cliente || '';
                document.getElementById('edit-cot-nuevo-cliente-notas').value = cotizacion.notas_cliente || '';
            }
            
            document.getElementById('edit-cot-fecha').value = cotizacion.fecha_evento || '';
            document.getElementById('edit-cot-hora-inicio').value = cotizacion.hora_inicio || '';
            document.getElementById('edit-cot-hora-fin').value = cotizacion.hora_fin || '';
            document.getElementById('edit-cot-lugar').value = cotizacion.lugar_evento || '';
            document.getElementById('edit-cot-invitados').value = cotizacion.numero_invitados || '';
            document.getElementById('edit-cot-notas').value = cotizacion.notas || '';
            
            editCotizacionCart = [];
            if (cotizacion.articulos) {
                cotizacion.articulos.forEach(art => {
                    editCotizacionCart.push({
                        tipo: 'articulo',
                        id: art.id_articulo,
                        nombre: art.nombre_articulo,
                        precio: parseFloat(art.precio_unitario),
                        cantidad: parseInt(art.cantidad)
                    });
                });
            }
            if (cotizacion.servicios) {
                cotizacion.servicios.forEach(serv => {
                    editCotizacionCart.push({
                        tipo: 'servicio',
                        id: serv.id_servicio,
                        nombre: serv.nombre_servicio,
                        precio: parseFloat(serv.precio_unitario),
                        cantidad: parseInt(serv.cantidad_horas)
                    });
                });
            }
            
            renderEditCotizacionCart();
            openModal('editarCotizacionModal');
            
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Error al cargar la cotización', 'error');
        }
    }

    function renderEditCotizacionCart() {
        const tbody = document.getElementById('edit-cot-cart-body');
        
        if (editCotizacionCart.length === 0) {
            tbody.innerHTML = '<tr class="empty-cart"><td colspan="5" class="text-center text-muted">No hay elementos</td></tr>';
            document.getElementById('edit-cot-cart-total').textContent = '0.00';
            return;
        }
        
        let total = 0;
        tbody.innerHTML = editCotizacionCart.map((item, index) => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;
            return `
                <tr>
                    <td><strong>${item.nombre}</strong><br><small>${item.tipo === 'articulo' ? 'Artículo' : 'Servicio'}</small></td>
                    <td>Q${item.precio.toFixed(2)}</td>
                    <td>
                        <div class="quantity-control">
                            <button class="btn btn-sm" onclick="updateEditCotQty(${index}, -1)">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" class="qty-input" value="${item.cantidad}" min="1" onchange="setEditCotQty(${index}, this.value)">
                            <button class="btn btn-sm" onclick="updateEditCotQty(${index}, 1)">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </td>
                    <td><strong>Q${subtotal.toFixed(2)}</strong></td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="removeFromEditCotCart(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('edit-cot-cart-total').textContent = total.toFixed(2);
    }

    function updateEditCotQty(index, delta) {
        editCotizacionCart[index].cantidad += delta;
        if (editCotizacionCart[index].cantidad <= 0) {
            editCotizacionCart.splice(index, 1);
        }
        renderEditCotizacionCart();
    }

    function setEditCotQty(index, value) {
        const cantidad = parseInt(value);
        if (isNaN(cantidad) || cantidad < 1) {
            renderEditCotizacionCart();
            return;
        }
        editCotizacionCart[index].cantidad = cantidad;
        renderEditCotizacionCart();
    }

    function removeFromEditCotCart(index) {
        editCotizacionCart.splice(index, 1);
        renderEditCotizacionCart();
    }

    function toggleEditCotClienteForm(tipo) {
        const existenteSection = document.getElementById('edit-cot-cliente-existente-section');
        const nuevoSection = document.getElementById('edit-cot-cliente-nuevo-section');
        
        if (tipo === 'existente') {
            existenteSection.classList.remove('hidden');
            nuevoSection.classList.add('hidden');
        } else {
            existenteSection.classList.add('hidden');
            nuevoSection.classList.remove('hidden');
        }
    }

    function toggleEditCotSection(sectionId) {
        const section = document.getElementById(sectionId);
        section.classList.toggle('hidden');
        
        if (!section.classList.contains('hidden') && sectionId === 'edit-cot-articulos-section') {
            cargarArticulosParaEditarCot();
        } else if (!section.classList.contains('hidden') && sectionId === 'edit-cot-servicios-section') {
            cargarServiciosParaEditarCot();
        }
    }

    async function cargarClientesParaEditarCot() {
        try {
            const response = await fetch('/api/clientes');
            const data = await response.json();
            
            const select = document.getElementById('edit-cot-cliente');
            select.innerHTML = '<option value="">Seleccionar cliente...</option>';
            
            if (data.clientes) {
                data.clientes.forEach(cliente => {
                    const option = document.createElement('option');
                    option.value = cliente.id_cliente;
                    option.textContent = `${cliente.nombre}${cliente.telefono ? ' - ' + cliente.telefono : ''}`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function cargarArticulosParaEditarCot() {
        try {
            const response = await fetch('/api/articulos');
            const data = await response.json();
            
            const grid = document.getElementById('edit-cot-articulos-grid');
            if (data.articulos && data.articulos.length > 0) {
                grid.innerHTML = data.articulos.map(art => `
                    <div class="item-card">
                        <div class="item-header">
                            <strong>${art.nombre_articulo}</strong>
                            <span class="item-code">${art.codigo}</span>
                        </div>
                        <div class="item-body">
                            <p class="item-description">${art.descripcion || ''}</p>
                            <div class="item-price">Q${parseFloat(art.precio).toFixed(2)}</div>
                        </div>
                        <div class="item-footer">
                            <button class="btn btn-sm btn-primary" onclick="agregarAEditCotCart('articulo', ${art.id_articulo}, '${art.nombre_articulo}', ${art.precio})">
                                <i class="fas fa-plus"></i> Agregar
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function cargarServiciosParaEditarCot() {
        try {
            const response = await fetch('/api/servicios');
            const data = await response.json();
            
            const grid = document.getElementById('edit-cot-servicios-grid');
            if (data.servicios && data.servicios.length > 0) {
                grid.innerHTML = data.servicios.map(serv => `
                    <div class="item-card">
                        <div class="item-header">
                            <strong>${serv.nombre_servicio}</strong>
                            <span class="item-code">${serv.codigo}</span>
                        </div>
                        <div class="item-body">
                            <p class="item-description">${serv.descripcion || ''}</p>
                            <div class="item-price">Q${parseFloat(serv.precio_hora).toFixed(2)}/hora</div>
                        </div>
                        <div class="item-footer">
                            <button class="btn btn-sm btn-primary" onclick="agregarAEditCotCart('servicio', ${serv.id_servicio}, '${serv.nombre_servicio}', ${serv.precio_hora})">
                                <i class="fas fa-plus"></i> Agregar
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function agregarAEditCotCart(tipo, id, nombre, precio) {
        const existe = editCotizacionCart.find(item => item.tipo === tipo && item.id === id);
        
        if (existe) {
            existe.cantidad++;
        } else {
            editCotizacionCart.push({
                tipo: tipo,
                id: id,
                nombre: nombre,
                precio: parseFloat(precio),
                cantidad: 1
            });
        }
        
        renderEditCotizacionCart();
    }

    async function actualizarCotizacion() {
        try {
            if (!idCotizacionEditar) {
                Swal.fire('Error', 'No se pudo identificar la cotización', 'error');
                return;
            }
            
            const tipoCliente = document.querySelector('input[name="edit-cot-cliente-tipo"]:checked').value;
            let idCliente = null;
            let nuevoCliente = null;
            
            if (tipoCliente === 'existente') {
                idCliente = document.getElementById('edit-cot-cliente').value;
                if (!idCliente) {
                    Swal.fire('Error', 'Debe seleccionar un cliente', 'error');
                    return;
                }
            } else {
                const nombre = document.getElementById('edit-cot-nuevo-cliente-nombre').value.trim();
                if (!nombre) {
                    Swal.fire('Error', 'Debe ingresar el nombre del cliente', 'error');
                    return;
                }
                nuevoCliente = {
                    nombre: nombre,
                    telefono: document.getElementById('edit-cot-nuevo-cliente-telefono').value.trim(),
                    direccion: document.getElementById('edit-cot-nuevo-cliente-direccion').value.trim(),
                    notas: document.getElementById('edit-cot-nuevo-cliente-notas').value.trim()
                };
            }
            
            if (editCotizacionCart.length === 0) {
                Swal.fire('Error', 'Debe agregar al menos un artículo o servicio', 'error');
                return;
            }
            
            const cotizacionData = {
                id_cliente: idCliente,
                nuevo_cliente: nuevoCliente,
                fecha_evento: document.getElementById('edit-cot-fecha').value,
                hora_inicio: document.getElementById('edit-cot-hora-inicio').value,
                hora_fin: document.getElementById('edit-cot-hora-fin').value,
                lugar_evento: document.getElementById('edit-cot-lugar').value.trim(),
                numero_invitados: document.getElementById('edit-cot-invitados').value,
                notas: document.getElementById('edit-cot-notas').value.trim(),
                articulos: editCotizacionCart.filter(item => item.tipo === 'articulo').map(item => ({
                    id_articulo: item.id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio
                })),
                servicios: editCotizacionCart.filter(item => item.tipo === 'servicio').map(item => ({
                    id_servicio: item.id,
                    cantidad_horas: item.cantidad,
                    precio_unitario: item.precio
                }))
            };
            
            const response = await fetch(`/api/cotizaciones/${idCotizacionEditar}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cotizacionData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Cotización Actualizada',
                    text: 'La cotización se actualizó correctamente'
                });
                closeModal('editarCotizacionModal');
                limpiarEditCotModal();
                loadCotizaciones();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Error al actualizar la cotización', 'error');
        }
    }

    function limpiarEditCotModal() {
        editCotizacionCart = [];
        idCotizacionEditar = null;
        document.getElementById('editar-cotizacion-form').reset();
        renderEditCotizacionCart();
    }

    // ─────────────────── VISUALIZAR COTIZACIÓN ───────────────────

    async function verDetalleCotizacion(idCotizacion) {
        try {
            const response = await fetch(`/api/cotizaciones/${idCotizacion}`);
            const data = await response.json();
            
            if (!data.success) {
                Swal.fire('Error', 'No se pudo cargar la cotización', 'error');
                return;
            }
            
            const cotizacion = data.cotizacion;
            
            document.getElementById('view-cot-cliente').textContent = cotizacion.nombre_cliente || 'No especificado';
            document.getElementById('view-cot-fecha').textContent = cotizacion.fecha_evento || '-';
            document.getElementById('view-cot-hora-inicio').textContent = cotizacion.hora_inicio || '-';
            document.getElementById('view-cot-hora-fin').textContent = cotizacion.hora_fin || '-';
            document.getElementById('view-cot-lugar').textContent = cotizacion.lugar_evento || '-';
            document.getElementById('view-cot-invitados').textContent = cotizacion.numero_invitados || '-';
            document.getElementById('view-cot-notas').textContent = cotizacion.notas || '-';
            
            viewCotizacionCart = [];
            if (cotizacion.articulos) {
                cotizacion.articulos.forEach(art => {
                    viewCotizacionCart.push({
                        tipo: 'articulo',
                        nombre: art.nombre_articulo,
                        precio: parseFloat(art.precio_unitario),
                        cantidad: parseInt(art.cantidad)
                    });
                });
            }
            if (cotizacion.servicios) {
                cotizacion.servicios.forEach(serv => {
                    viewCotizacionCart.push({
                        tipo: 'servicio',
                        nombre: serv.nombre_servicio,
                        precio: parseFloat(serv.precio_unitario),
                        cantidad: parseInt(serv.cantidad_horas)
                    });
                });
            }
            
            renderViewCotizacionCart();
            openModal('visualizarCotizacionModal');
            
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Error al cargar la cotización', 'error');
        }
    }

    function renderViewCotizacionCart() {
        const tbody = document.getElementById('view-cot-cart-body');
        
        if (viewCotizacionCart.length === 0) {
            tbody.innerHTML = '<tr class="empty-cart"><td colspan="4" class="text-center text-muted">No hay elementos</td></tr>';
            document.getElementById('view-cot-cart-total').textContent = '0.00';
            return;
        }
        
        let total = 0;
        tbody.innerHTML = viewCotizacionCart.map(item => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;
            return `
                <tr>
                    <td><strong>${item.nombre}</strong><br><small>${item.tipo === 'articulo' ? 'Artículo' : 'Servicio'}</small></td>
                    <td>Q${item.precio.toFixed(2)}</td>
                    <td>${item.cantidad}</td>
                    <td><strong>Q${subtotal.toFixed(2)}</strong></td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('view-cot-cart-total').textContent = total.toFixed(2);
    }




    // ===============================================
    // FUNCIONES ESPECÍFICAS PARA COTIZACIÓN
    // ===============================================

    // Toggle entre cliente existente y nuevo (COTIZACIÓN)
    function toggleClienteFormCot(tipo) {
        const existenteSection = document.getElementById('cliente-existente-section-cot');
        const nuevoSection = document.getElementById('cliente-nuevo-section-cot');
        
        if (tipo === 'existente') {
            existenteSection.classList.remove('hidden');
            nuevoSection.classList.add('hidden');
            // Limpiar campos de nuevo cliente
            document.getElementById('nuevo-cliente-nombre-cot').value = '';
            document.getElementById('nuevo-cliente-telefono-cot').value = '';
            document.getElementById('nuevo-cliente-direccion-cot').value = '';
            document.getElementById('nuevo-cliente-notas-cot').value = '';
        } else {
            existenteSection.classList.add('hidden');
            nuevoSection.classList.remove('hidden');
            // Limpiar selección de cliente existente
            document.getElementById('cotizacion-cliente').value = '';
        }
    }

    // Toggle para mostrar/ocultar secciones de artículos y servicios (COTIZACIÓN)
    function toggleCotizacionSection(sectionId) {
        const section = document.getElementById(sectionId);
        section.classList.toggle('hidden');
        
        // Si se muestra la sección de artículos por primera vez, cargar los artículos
        if (sectionId === 'articulos-section-cot' && !section.classList.contains('hidden')) {
            if (!articulosLoadedCot) {
                loadArticulosForCotizacion();
                articulosLoadedCot = true;
            }
        }
        
        // Si se muestra la sección de servicios por primera vez, cargar los servicios
        if (sectionId === 'servicios-section-cot' && !section.classList.contains('hidden')) {
            if (!serviciosLoadedCot) {
                loadServiciosForCotizacion();
                serviciosLoadedCot = true;
            }
        }
    }

    // Cargar artículos para cotización
    async function loadArticulosForCotizacion() {
        try {
            const response = await fetch('/api/articulos');
            const data = await response.json();
            
            if (data.success) {
                articulosDataCot = data.articulos;
                renderArticulosGridCot(articulosDataCot);
            }
        } catch (error) {
            console.error('Error loading artículos para cotización:', error);
        }
    }

    // Renderizar grid de artículos para cotización
    function renderArticulosGridCot(articulos) {
        const grid = document.getElementById('articulos-grid-cot');
        
        if (articulos.length === 0) {
            grid.innerHTML = '<p class="text-muted">No hay artículos disponibles</p>';
            return;
        }
        
        grid.innerHTML = articulos.map(articulo => `
            <div class="item-card" onclick="agregarArticuloCot(${articulo.id_articulo}, '${articulo.nombre_articulo.replace(/'/g, "\'")}', ${articulo.precio_unitario})">
                <h5>${articulo.nombre_articulo}</h5>
                <div class="price">Q${parseFloat(articulo.precio_unitario || 0).toFixed(2)}</div>
                <div class="stock">Stock: ${articulo.cantidad_disponible || 0}</div>
            </div>
        `).join('');
    }

    // Filtrar artículos para cotización
    function filterArticulosCot() {
        const searchTerm = document.getElementById('search-articulos-cot').value.toLowerCase();
        const filtered = articulosDataCot.filter(art => 
            art.nombre_articulo.toLowerCase().includes(searchTerm) ||
            art.codigo.toLowerCase().includes(searchTerm) ||
            (art.descripcion && art.descripcion.toLowerCase().includes(searchTerm))
        );
        renderArticulosGridCot(filtered);
    }

    // Agregar artículo al carrito de cotización
    function agregarArticuloCot(id, nombre, precio) {
        // Verificar si ya existe en el carrito
        const existe = cotizacionCart.find(item => item.tipo === 'articulo' && item.id === id);
        
        if (existe) {
            existe.cantidad++;
        } else {
            cotizacionCart.push({
                tipo: 'articulo',
                id: id,
                nombre: nombre,
                precio: parseFloat(precio),
                cantidad: 1
            });
        }
        
        renderCotizacionCart();
    }

    // Cargar servicios para cotización
    async function loadServiciosForCotizacion() {
        try {
            const response = await fetch('/api/servicios');
            const data = await response.json();
            
            if (data.success) {
                serviciosDataCot = data.servicios;
                renderServiciosGridCot(serviciosDataCot);
            }
        } catch (error) {
            console.error('Error loading servicios para cotización:', error);
        }
    }

    // Renderizar grid de servicios para cotización
    function renderServiciosGridCot(servicios) {
        const grid = document.getElementById('servicios-grid-cot');
        
        if (servicios.length === 0) {
            grid.innerHTML = '<p class="text-muted">No hay servicios disponibles</p>';
            return;
        }
        
        grid.innerHTML = servicios.map(servicio => `
            <div class="item-card">
                <div class="item-header">
                    <strong>${servicio.nombre_servicio}</strong>
                    <span class="item-code">${servicio.codigo}</span>
                </div>
                <div class="item-body">
                    <p class="item-description">${servicio.descripcion || 'Sin descripción'}</p>
                    <div class="item-price">Q${parseFloat(servicio.precio_hora || 0).toFixed(2)}/hora</div>
                </div>
                <div class="item-footer">
                    <button class="btn btn-sm btn-primary" onclick="agregarServicioCot(${servicio.id_servicio}, '${servicio.nombre_servicio}', ${servicio.precio_hora})">
                        <i class="fas fa-plus"></i> Agregar
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Agregar servicio al carrito de cotización
    function agregarServicioCot(id, nombre, precioHora) {
        // Verificar si ya existe en el carrito
        const existe = cotizacionCart.find(item => item.tipo === 'servicio' && item.id === id);
        
        if (existe) {
            existe.cantidad++;
        } else {
            cotizacionCart.push({
                tipo: 'servicio',
                id: id,
                nombre: nombre,
                precio: parseFloat(precioHora),
                cantidad: 1 // Para servicios, esto representa horas
            });
        }
        
        renderCotizacionCart();
    }

    // Renderizar carrito de cotización
    function renderCotizacionCart() {
        const tbody = document.getElementById('cart-body-cot');
        
        if (cotizacionCart.length === 0) {
            tbody.innerHTML = '<tr class="empty-cart"><td colspan="5" class="text-center text-muted">No hay elementos en la cotización</td></tr>';
            document.getElementById('cart-total-cot').textContent = '0.00';
            return;
        }
        
        let total = 0;
        
        tbody.innerHTML = cotizacionCart.map((item, index) => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;
            
            const unidad = item.tipo === 'servicio' ? 'horas' : 'unidades';
            
            return `
                <tr>
                    <td>
                        <strong>${item.nombre}</strong>
                        <br>
                        <small class="text-muted">${item.tipo === 'articulo' ? 'Artículo' : 'Servicio'}</small>
                    </td>
                    <td>Q${item.precio.toFixed(2)}</td>
                    <td>
                        <div class="quantity-control">
                            <button class="btn btn-sm" onclick="updateCotizacionQuantity(${index}, -1)">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" class="qty-input" value="${item.cantidad}" min="1" onchange="setCotizacionQuantity(${index}, this.value)">
                            <button class="btn btn-sm" onclick="updateCotizacionQuantity(${index}, 1)">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </td>
                    <td><strong>Q${subtotal.toFixed(2)}</strong></td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="removeFromCotizacionCart(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('cart-total-cot').textContent = total.toFixed(2);
    }

    // Actualizar cantidad en carrito de cotización
    function updateCotizacionQuantity(index, delta) {
        cotizacionCart[index].cantidad += delta;
        
        if (cotizacionCart[index].cantidad <= 0) {
            cotizacionCart.splice(index, 1);
        }
        
        renderCotizacionCart();
    }

    function setCotizacionQuantity(index, value) {
        const cantidad = parseInt(value);
        if (isNaN(cantidad) || cantidad < 1) {
            renderCotizacionCart();
            return;
        }
        cotizacionCart[index].cantidad = cantidad;
        renderCotizacionCart();
    }

    // Remover del carrito de cotización
    function removeFromCotizacionCart(index) {
        cotizacionCart.splice(index, 1);
        renderCotizacionCart();
    }

    // Guardar cotización completa
    async function guardarCotizacionCompleta() {
        try {
            // Validar datos básicos
            const tipoCliente = document.querySelector('input[name="cliente-tipo-cot"]:checked').value;
            let idCliente = null;
            let nuevoCliente = null;
            
            if (tipoCliente === 'existente') {
                idCliente = document.getElementById('cotizacion-cliente').value;
                if (!idCliente) {
                    Swal.fire('Error', 'Debe seleccionar un cliente', 'error');
                    return;
                }
            } else {
                const nombre = document.getElementById('nuevo-cliente-nombre-cot').value.trim();
                if (!nombre) {
                    Swal.fire('Error', 'Debe ingresar el nombre del cliente', 'error');
                    return;
                }
                
                nuevoCliente = {
                    nombre: nombre,
                    telefono: document.getElementById('nuevo-cliente-telefono-cot').value.trim(),
                    direccion: document.getElementById('nuevo-cliente-direccion-cot').value.trim(),
                    notas: document.getElementById('nuevo-cliente-notas-cot').value.trim()
                };
            }
            
            // Validar que haya elementos en el carrito
            if (cotizacionCart.length === 0) {
                Swal.fire('Error', 'Debe agregar al menos un artículo o servicio', 'error');
                return;
            }
            
            // Preparar datos
            const cotizacionData = {
                id_cliente: idCliente,
                nuevo_cliente: nuevoCliente,
                fecha_evento: document.getElementById('cotizacion-fecha').value,
                hora_inicio: document.getElementById('cotizacion-hora-inicio').value,
                hora_fin: document.getElementById('cotizacion-hora-fin').value,
                lugar_evento: document.getElementById('cotizacion-lugar').value.trim(),
                numero_invitados: document.getElementById('cotizacion-invitados').value,
                notas: document.getElementById('cotizacion-notas').value.trim(),
                articulos: cotizacionCart.filter(item => item.tipo === 'articulo').map(item => ({
                    id_articulo: item.id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio
                })),
                servicios: cotizacionCart.filter(item => item.tipo === 'servicio').map(item => ({
                    id_servicio: item.id,
                    cantidad_horas: item.cantidad,
                    precio_unitario: item.precio
                }))
            };
            
            // Enviar al servidor
            const response = await fetch('/api/cotizaciones/completa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cotizacionData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Cotización Creada',
                    text: `Cotización ${data.numero_cotizacion} creada exitosamente`,
                    showConfirmButton: true
                });
                
                // Limpiar formulario y cerrar modal
                closeModal('cotizacionModal');
                limpiarFormularioCotizacion();
                loadCotizaciones();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
            
        } catch (error) {
            console.error('Error guardando cotización:', error);
            Swal.fire('Error', 'Error al guardar la cotización', 'error');
        }
    }

    // Limpiar formulario de cotización
    function limpiarFormularioCotizacion() {
        // Resetear radio buttons
        document.querySelector('input[name="cliente-tipo-cot"][value="existente"]').checked = true;
        toggleClienteFormCot('existente');
        
        // Limpiar campos
        document.getElementById('cotizacion-cliente').value = '';
        document.getElementById('cotizacion-fecha').value = '';
        document.getElementById('cotizacion-hora-inicio').value = '';
        document.getElementById('cotizacion-hora-fin').value = '';
        document.getElementById('cotizacion-lugar').value = '';
        document.getElementById('cotizacion-invitados').value = '';
        document.getElementById('cotizacion-notas').value = '';
        
        // Limpiar carrito
        cotizacionCart = [];
        renderCotizacionCart();
        
        // Ocultar secciones
        document.getElementById('articulos-section-cot').classList.add('hidden');
        document.getElementById('servicios-section-cot').classList.add('hidden');
        document.getElementById('toggleArticulosCot').checked = false;
        document.getElementById('toggleServiciosCot').checked = false;
        
        // Resetear flags
        articulosLoadedCot = false;
        serviciosLoadedCot = false;
    }
