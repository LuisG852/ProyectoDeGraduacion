    // ===============================================
    // GESTIÓN DE EVENTOS
    // ===============================================
    async function loadEventos() {
        try {
            const response = await fetch('/api/eventos');
            const data = await response.json();
            
            if (data.success) {
                eventos = data.eventos;
                allEventos = data.eventos || [];
                
                pagination_eventos.init(allEventos, (items) => {
                    renderEventosPage(items);
                });
            }
        } catch (error) {
            console.error('Error loading eventos:', error);
            const tbody = document.getElementById('eventos-table-body');
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Error al cargar eventos</td></tr>';
        }
    }

    function renderEventosPage(eventosList) {
        const tbody = document.getElementById('eventos-table-body');
        
        if (eventosList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay eventos en esta página</td></tr>';
            return;
        }
        
        tbody.classList.add('table-animated');
        setTimeout(() => tbody.classList.remove('table-animated'), 300);

        tbody.innerHTML = eventosList.map(evento => {
            if (!evento.id_evento) {
                console.warn('⚠️ Evento sin ID:', evento);
            }
            
            const estadoColor = getEstadoBackgroundColor(evento.estado);
            
            return `
                <tr>
                    <td>${evento.cliente_nombre}</td>
                    <td>${formatDate(evento.fecha_evento)}</td>
                    <td>${evento.lugar_evento || '-'}</td>
                    <td>
                        <select class="form-control" 
                                style="padding: 0.5rem; font-size: 0.875rem; background: ${estadoColor}; font-weight: 600; border: 2px solid rgba(0,0,0,0.1); min-width: 150px;" 
                                onchange="cambiarEstadoEvento(${evento.id_evento}, this.value)">
                            <option value="reservado" ${evento.estado === 'reservado' ? 'selected' : ''}>Reservado</option>
                            <option value="pendiente_pago" ${evento.estado === 'pendiente_pago' ? 'selected' : ''}>Pendiente de Pago</option>
                            <option value="cancelado" ${evento.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </td>
                    <td>Q${parseFloat(evento.monto_total || 0).toFixed(2)}</td>
                    <td>
                        <button class="btn btn-success btn-sm" 
                                onclick="abrirGestionArticulosEvento(${evento.id_evento})" 
                                title="Gestionar Artículos"
                                data-evento-id="${evento.id_evento}">
                            <i class="fas fa-boxes"></i> Artículos
                        </button>
                    </td>
                    <td>
                        <button class="btn btn-icon btn-view" onclick="verDetalleEvento(${evento.id_evento})" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-icon btn-edit" onclick="abrirEdicionEvento(${evento.id_evento})"  title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="eliminarEvento(${evento.id_evento})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }


    async function eliminarEvento(id) {
        // Primero verificar si el evento tiene artículos o pagos asociados
        try {
            const checkResponse = await fetch(`/api/eventos/${id}/puede-eliminar`);
            const checkData = await checkResponse.json();
            
            let warningMessage = '¿Estás seguro de eliminar este evento?';
            if (checkData.tiene_articulos || checkData.tiene_pagos) {
                warningMessage = `<div style="text-align: left;">
                    <p><strong>⚠️ Advertencia:</strong></p>
                    <ul style="margin-top: 0.5rem;">
                        ${checkData.tiene_articulos ? '<li>Este evento tiene artículos asociados</li>' : ''}
                        ${checkData.tiene_pagos ? '<li>Este evento tiene pagos registrados</li>' : ''}
                    </ul>
                    <p style="margin-top: 1rem;">¿Deseas continuar con la eliminación?</p>
                </div>`;
            }
            
            const result = await Swal.fire({
                title: 'Confirmar Eliminación',
                html: warningMessage,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#EF4444'
            });

            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Eliminando...',
                    text: 'Por favor espera',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const response = await fetch(`/api/eventos/${id}`, { 
                    method: 'DELETE' 
                });
                const data = await response.json();
                
                if (data.success) {
                    Swal.fire('Eliminado', 'Evento eliminado correctamente', 'success');
                    await loadEventos();
                    await loadDashboardData();
                    
                    // Actualizar calendario si está visible
                    const calendarioSection = document.getElementById('calendario');
                    if (calendarioSection && calendarioSection.classList.contains('active')) {
                        await generateCalendar();
                    }
                } else {
                    Swal.fire('Error', data.message || 'No se pudo eliminar el evento', 'error');
                }
            }
        } catch (error) {
            console.error('Error eliminando evento:', error);
            Swal.fire('Error', 'Error al eliminar el evento', 'error');
        }
    }

    document.getElementById('search-eventos')?.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredEventos = eventos.filter(evento => 
            (evento.cliente_nombre && evento.cliente_nombre.toLowerCase().includes(searchTerm)) ||
            (evento.lugar_evento && evento.lugar_evento.toLowerCase().includes(searchTerm)) ||
            (evento.numero_evento && evento.numero_evento.toLowerCase().includes(searchTerm)) ||
            (evento.estado && evento.estado.toLowerCase().includes(searchTerm))
        );
        renderEventosPage(filteredEventos);
    });


    document.getElementById('filter-estado')?.addEventListener('change', function(e) {
        const estadoFiltro = e.target.value;
        const searchTerm = document.getElementById('search-eventos').value.toLowerCase();
        
        let filteredEventos = eventos;
        
        // Aplicar filtro de estado
        if (estadoFiltro) {
            filteredEventos = filteredEventos.filter(evento => evento.estado === estadoFiltro);
        }
        
        // Aplicar filtro de búsqueda
        if (searchTerm) {
            filteredEventos = filteredEventos.filter(evento => 
                (evento.cliente_nombre && evento.cliente_nombre.toLowerCase().includes(searchTerm)) ||
                (evento.lugar_evento && evento.lugar_evento.toLowerCase().includes(searchTerm)) ||
                (evento.numero_evento && evento.numero_evento.toLowerCase().includes(searchTerm))
            );
        }
        
        renderEventosPage(filteredEventos);
    });


    // Función para cambiar el estado del evento
    async function cambiarEstadoEvento(eventoId, nuevoEstado) {
        const descripciones = {
            'reservado': 'El evento estará reservado',
            'cancelado': 'El evento será cancelado',
            'pendiente_pago': 'El evento quedará pendiente de pago',
        };

        const confirmacion = await Swal.fire({
            title: '¿Cambiar estado del evento?',
            html: `
                <div style="text-align: left;">
                    <p>El estado cambiará a: <strong>${nuevoEstado.replace('_', ' ').toUpperCase()}</strong></p>
                    <p class="text-muted" style="font-size: 0.9rem; margin-top: 0.5rem;">
                        ${descripciones[nuevoEstado]}
                    </p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cambiar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmacion.isConfirmed) {
            await loadEventos();
            return;
        }

        try {
            Swal.fire({
                title: 'Actualizando...',
                text: 'Cambiando estado del evento',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await fetch(`/api/eventos/${eventoId}/estado`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire('Éxito', 'Estado del evento actualizado correctamente', 'success');
                await loadEventos();
                
                const calendarioSection = document.getElementById('calendario');
                if (calendarioSection && calendarioSection.classList.contains('active')) {
                    await generateCalendar();
                }
                
                await loadDashboardData();
            } else {
                Swal.fire('Error', data.message, 'error');
                await loadEventos();
            }
        } catch (error) {
            console.error('Error cambiando estado del evento:', error);
            Swal.fire('Error', 'Error al cambiar estado del evento', 'error');
            await loadEventos();
        }
    }

    async function actualizarEvento() {
        const id = document.getElementById('edit-evento-id').value;
        const clienteId = document.getElementById('edit-evento-cliente').value;
        const fecha = document.getElementById('edit-evento-fecha').value;
        const horaInicio = document.getElementById('edit-evento-hora-inicio').value;
        const horaFin = document.getElementById('edit-evento-hora-fin').value;
        const lugar = document.getElementById('edit-evento-lugar').value;
        const invitados = document.getElementById('edit-evento-invitados').value;
        const estado = document.getElementById('edit-evento-estado').value;
        const notas = document.getElementById('edit-evento-notas').value;

        if (!clienteId || !fecha) {
            Swal.fire('Error', 'Cliente y fecha son requeridos', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/eventos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_cliente: clienteId,
                    fecha_evento: fecha,
                    hora_inicio: horaInicio,
                    hora_fin: horaFin,
                    lugar_evento: lugar,
                    numero_invitados: invitados,
                    estado: estado,
                    notas: notas
                })
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire('Éxito', 'Evento actualizado correctamente', 'success');
                closeModal('editarEventoModal');
                loadEventos();
                loadDashboardData();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error updating evento:', error);
            Swal.fire('Error', 'Error al actualizar evento', 'error');
        }
    }

    async function verEvento(id) {
        // Redirigir a la función que usa el modal correcto
        return await verDetalleEvento(id);
    }


    // ===============================================
    // CARRITO DE EVENTOS
    // ===============================================
    function toggleEventoSection(sectionId) {
        const section = document.getElementById(sectionId);
        const isVisible = !section.classList.contains('hidden');
        
        if (isVisible) {
            section.classList.add('hidden');
        } else {
            section.classList.remove('hidden');
            
            if (sectionId === 'articulos-section' && articulosDisponibles.length === 0) {
                loadArticulosParaEvento();
            } else if (sectionId === 'servicios-section' && serviciosDisponibles.length === 0) {
                loadServiciosParaEvento();
            }
        }
    }

    async function loadArticulosParaEvento() {
        try {
            const response = await fetch('/api/articulos');
            const data = await response.json();
            
            if (data.success) {
                articulosDisponibles = data.articulos;
                renderArticulosGrid();
            }
        } catch (error) {
            console.error('Error loading artículos:', error);
        }
    }

    async function loadServiciosParaEvento() {
        try {
            const response = await fetch('/api/servicios');
            const data = await response.json();
            
            if (data.success) {
                serviciosDisponibles = data.servicios;
                renderServiciosGrid();
            }
        } catch (error) {
            console.error('Error loading servicios:', error);
        }
    }

    function renderArticulosGrid() {
        const grid = document.getElementById('articulos-grid');
        
        if (articulosDisponibles.length === 0) {
            grid.innerHTML = '<p class="text-muted">No hay artículos disponibles</p>';
            return;
        }
        
        grid.innerHTML = articulosDisponibles.map(articulo => `
            <div class="item-card" onclick="addItemToCart('articulo', ${articulo.id_articulo})">
                <h5>${articulo.nombre_articulo}</h5>
                <div class="price">Q${parseFloat(articulo.precio_unitario).toFixed(2)}</div>
                <div class="stock">Stock: ${articulo.cantidad_disponible}</div>
            </div>
        `).join('');
    }

    function renderServiciosGrid() {
        const grid = document.getElementById('servicios-grid');
        
        if (serviciosDisponibles.length === 0) {
            grid.innerHTML = '<p class="text-muted">No hay servicios disponibles</p>';
            return;
        }
        
        grid.innerHTML = serviciosDisponibles.map(servicio => `
            <div class="item-card" onclick="addItemToCart('servicio', ${servicio.id_servicio})">
                <h5>${servicio.nombre_servicio}</h5>
                <div class="price">Q${parseFloat(servicio.precio_fijo || servicio.precio_por_hora).toFixed(2)}</div>
                <div class="stock">${servicio.categoria}</div>
            </div>
        `).join('');
    }

    function addItemToCart(tipo, id) {
        let item;
        
        if (tipo === 'articulo') {
            item = articulosDisponibles.find(a => a.id_articulo === id);
            if (!item) return;
            
            const existing = eventoCart.find(c => c.tipo === 'articulo' && c.id === id);
            if (existing) {
                existing.cantidad++;
            } else {
                eventoCart.push({
                    tipo: 'articulo',
                    id: item.id_articulo,
                    nombre: item.nombre_articulo,
                    precio: parseFloat(item.precio_unitario),
                    cantidad: 1,
                    stock: item.cantidad_disponible
                });
            }
        } else if (tipo === 'servicio') {
            item = serviciosDisponibles.find(s => s.id_servicio === id);
            if (!item) return;
            
            const existing = eventoCart.find(c => c.tipo === 'servicio' && c.id === id);
            if (existing) {
                existing.cantidad++;
            } else {
                eventoCart.push({
                    tipo: 'servicio',
                    id: item.id_servicio,
                    nombre: item.nombre_servicio,
                    precio: parseFloat(item.precio_fijo || item.precio_por_hora),
                    cantidad: 1
                });
            }
        }
        
        renderCart();
    }

    function renderCart() {
        const tbody = document.getElementById('cart-body');
        
        if (eventoCart.length === 0) {
            tbody.innerHTML = '<tr class="empty-cart"><td colspan="5" class="text-center text-muted">No hay elementos en el carrito</td></tr>';
            document.getElementById('cart-total').textContent = '0.00';
            return;
        }
        
        let total = 0;
        
        tbody.innerHTML = eventoCart.map((item, index) => {
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
                            <button class="qty-btn" onclick="changeCartQuantity(${index}, -1)">-</button>
                            <input type="number" class="qty-input" value="${item.cantidad}" min="1" onchange="setCartQuantity(${index}, this.value)">
                            <button class="qty-btn" onclick="changeCartQuantity(${index}, 1)">+</button>
                        </div>
                    </td>
                    <td>Q${subtotal.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="removeFromCart(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('cart-total').textContent = total.toFixed(2);
    }

    function changeCartQuantity(index, delta) {
        const item = eventoCart[index];
        item.cantidad += delta;
        
        if (item.cantidad <= 0) {
            eventoCart.splice(index, 1);
        }
        
        renderCart();
    }

    function setCartQuantity(index, value) {
        const cantidad = parseInt(value);
        if (isNaN(cantidad) || cantidad < 1) {
            renderCart();
            return;
        }
        eventoCart[index].cantidad = cantidad;
        renderCart();
    }

    function removeFromCart(index) {
        eventoCart.splice(index, 1);
        renderCart();
    }

    async function guardarEventoCompleto() {
        const tipoCliente = document.querySelector('input[name="cliente-tipo"]:checked').value;
        const fecha = document.getElementById('evento-fecha').value;
        
        if (!fecha) {
            Swal.fire('Error', 'La fecha del evento es requerida', 'error');
            return;
        }
        
        let clienteId;
        
        if (tipoCliente === 'nuevo') {
            const nombre = document.getElementById('nuevo-cliente-nombre').value.trim();
            const telefono = document.getElementById('nuevo-cliente-telefono').value.trim();
            const direccion = document.getElementById('nuevo-cliente-direccion').value.trim();
            const notas = document.getElementById('nuevo-cliente-notas').value.trim();
            
            if (!nombre) {
                Swal.fire('Error', 'El nombre del cliente es requerido', 'error');
                return;
            }
            
            try {
                const clienteResponse = await fetch('/api/clientes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, telefono, direccion, notas })
                });
                
                const clienteData = await clienteResponse.json();
                
                if (!clienteData.success) {
                    Swal.fire('Error', 'Error al crear cliente: ' + clienteData.message, 'error');
                    return;
                }
                
                clienteId = clienteData.cliente_id;
                await loadClientes();
                
            } catch (error) {
                console.error('Error creando cliente:', error);
                Swal.fire('Error', 'Error al crear cliente', 'error');
                return;
            }
        } else {
            clienteId = document.getElementById('evento-cliente').value;
            
            if (!clienteId) {
                Swal.fire('Error', 'Debe seleccionar un cliente', 'error');
                return;
            }
        }
        
        const eventoData = {
            id_cliente: parseInt(clienteId),
            fecha_evento: fecha,
            hora_inicio: document.getElementById('evento-hora-inicio').value,
            hora_fin: document.getElementById('evento-hora-fin').value,
            lugar_evento: document.getElementById('evento-lugar').value,
            numero_invitados: document.getElementById('evento-invitados').value ? parseInt(document.getElementById('evento-invitados').value) : null,
            notas: document.getElementById('evento-notas').value,
            monto_total: parseFloat(document.getElementById('cart-total').textContent),
            articulos: eventoCart.filter(item => item.tipo === 'articulo').map(item => ({
                id_articulo: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            })),
            servicios: eventoCart.filter(item => item.tipo === 'servicio').map(item => ({
                id_servicio: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            }))
        };
        
        try {
            const response = await fetch('/api/eventos/completo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventoData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                Swal.fire('Éxito', 'Evento guardado correctamente', 'success');
                closeModal('eventoModal');
                
                eventoCart = [];
                renderCart();
                document.getElementById('evento-form').reset();
                document.querySelector('input[name="cliente-tipo"][value="existente"]').checked = true;
                toggleClienteForm('existente');
                
                loadEventos();
                loadDashboardData();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error saving evento completo:', error);
            Swal.fire('Error', 'Error al guardar evento', 'error');
        }
    }



    // ════════════════════════════════════════════════════════════════
    // MODALES INDEPENDIENTES PARA EDITAR Y VISUALIZAR
    // ════════════════════════════════════════════════════════════════

    // Variables para carritos independientes


    // ─────────────────── EDITAR EVENTO ───────────────────

    async function abrirEdicionEvento(idEvento) {
        try {
            idEventoEditar = idEvento;
            
            // Obtener datos del evento
            const response = await fetch(`/api/eventos/${idEvento}`);
            const data = await response.json();
            
            if (!data.success) {
                Swal.fire('Error', 'No se pudo cargar el evento', 'error');
                return;
            }
            
            const evento = data.evento;
            
            // Cargar clientes en el select
            await cargarClientesParaEditar();
            
            // Cargar datos en formulario
            if (evento.id_cliente) {
                document.querySelector('input[name="edit-cliente-tipo"][value="existente"]').checked = true;
                toggleEditClienteForm('existente');
                document.getElementById('edit-evento-cliente').value = evento.id_cliente;
            } else {
                document.querySelector('input[name="edit-cliente-tipo"][value="nuevo"]').checked = true;
                toggleEditClienteForm('nuevo');
                document.getElementById('edit-nuevo-cliente-nombre').value = evento.nombre_cliente || '';
                document.getElementById('edit-nuevo-cliente-telefono').value = evento.telefono_cliente || '';
                document.getElementById('edit-nuevo-cliente-direccion').value = evento.direccion_cliente || '';
                document.getElementById('edit-nuevo-cliente-notas').value = evento.notas_cliente || '';
            }
            
            document.getElementById('edit-evento-fecha').value = evento.fecha_evento || '';
            document.getElementById('edit-evento-hora-inicio').value = evento.hora_inicio || '';
            document.getElementById('edit-evento-hora-fin').value = evento.hora_fin || '';
            document.getElementById('edit-evento-lugar').value = evento.lugar_evento || '';
            document.getElementById('edit-evento-invitados').value = evento.numero_invitados || '';
            document.getElementById('edit-evento-notas').value = evento.notas || '';
            
            // Cargar carrito desde la base de datos
            editEventoCart = [];
            if (evento.articulos) {
                evento.articulos.forEach(art => {
                    editEventoCart.push({
                        tipo: 'articulo',
                        id: art.id_articulo,
                        nombre: art.nombre_articulo,
                        precio: parseFloat(art.precio_unitario),
                        cantidad: parseInt(art.cantidad) || 1
                    });
                });
            }
            if (evento.servicios) {
                evento.servicios.forEach(serv => {
                    editEventoCart.push({
                        tipo: 'servicio',
                        id: serv.id_servicio,
                        nombre: serv.nombre_servicio,
                        precio: parseFloat(serv.precio_unitario),
                        cantidad: parseInt(serv.cantidad_horas) || 1
                    });
                });
            }
            
            renderEditEventoCart();
            openModal('editarEventoModal');
            
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Error al cargar el evento', 'error');
        }
    }

    function renderEditEventoCart() {
        const tbody = document.getElementById('edit-cart-body');
        
        if (editEventoCart.length === 0) {
            tbody.innerHTML = '<tr class="empty-cart"><td colspan="5" class="text-center text-muted">No hay elementos</td></tr>';
            document.getElementById('edit-cart-total').textContent = '0.00';
            return;
        }
        
        let total = 0;
        tbody.innerHTML = editEventoCart.map((item, index) => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;
            return `
                <tr>
                    <td><strong>${item.nombre}</strong><br><small>${item.tipo === 'articulo' ? 'Artículo' : 'Servicio'}</small></td>
                    <td>Q${item.precio.toFixed(2)}</td>
                    <td>
                        <div class="quantity-control">
                            <button class="btn btn-sm" onclick="updateEditEventoQty(${index}, -1)">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" class="qty-input" value="${item.cantidad}" min="1" onchange="setEditEventoQty(${index}, this.value)">
                            <button class="btn btn-sm" onclick="updateEditEventoQty(${index}, 1)">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </td>
                    <td><strong>Q${subtotal.toFixed(2)}</strong></td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="removeFromEditEventoCart(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('edit-cart-total').textContent = total.toFixed(2);
    }

    function updateEditEventoQty(index, delta) {
        editEventoCart[index].cantidad += delta;
        if (editEventoCart[index].cantidad <= 0) {
            editEventoCart.splice(index, 1);
        }
        renderEditEventoCart();
    }

    function setEditEventoQty(index, value) {
        const cantidad = parseInt(value);
        if (isNaN(cantidad) || cantidad < 1) {
            renderEditEventoCart();
            return;
        }
        editEventoCart[index].cantidad = cantidad;
        renderEditEventoCart();
    }

    function removeFromEditEventoCart(index) {
        editEventoCart.splice(index, 1);
        renderEditEventoCart();
    }

    function toggleEditClienteForm(tipo) {
        const existenteSection = document.getElementById('edit-cliente-existente-section');
        const nuevoSection = document.getElementById('edit-cliente-nuevo-section');
        
        if (tipo === 'existente') {
            existenteSection.classList.remove('hidden');
            nuevoSection.classList.add('hidden');
        } else {
            existenteSection.classList.add('hidden');
            nuevoSection.classList.remove('hidden');
        }
    }

    function toggleEditEventoSection(sectionId) {
        const section = document.getElementById(sectionId);
        section.classList.toggle('hidden');
        
        if (!section.classList.contains('hidden') && sectionId === 'edit-articulos-section') {
            cargarArticulosParaEditar();
        } else if (!section.classList.contains('hidden') && sectionId === 'edit-servicios-section') {
            cargarServiciosParaEditar();
        }
    }

    async function cargarClientesParaEditar() {
        try {
            const response = await fetch('/api/clientes');
            const data = await response.json();
            
            const select = document.getElementById('edit-evento-cliente');
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
            console.error('Error cargando clientes:', error);
        }
    }

    async function cargarArticulosParaEditar() {
        try {
            const response = await fetch('/api/articulos');
            const data = await response.json();
            
            const grid = document.getElementById('edit-articulos-grid');
            if (data.articulos && data.articulos.length > 0) {
                grid.innerHTML = data.articulos.map(art => `
                    <div class="item-card">
                        <div class="item-header">
                            <strong>${art.nombre_articulo}</strong>
                            <span class="item-code">${art.codigo}</span>
                        </div>
                        <div class="item-body">
                            <p class="item-description">${art.descripcion || 'Sin descripción'}</p>
                            <div class="item-price">Q${parseFloat(art.precio).toFixed(2)}</div>
                        </div>
                        <div class="item-footer">
                            <button class="btn btn-sm btn-primary" onclick="agregarAEditEventoCart('articulo', ${art.id_articulo}, '${art.nombre_articulo}', ${art.precio})">
                                <i class="fas fa-plus"></i> Agregar
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = '<p class="text-muted">No hay artículos disponibles</p>';
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function cargarServiciosParaEditar() {
        try {
            const response = await fetch('/api/servicios');
            const data = await response.json();
            
            const grid = document.getElementById('edit-servicios-grid');
            if (data.servicios && data.servicios.length > 0) {
                grid.innerHTML = data.servicios.map(serv => `
                    <div class="item-card">
                        <div class="item-header">
                            <strong>${serv.nombre_servicio}</strong>
                            <span class="item-code">${serv.codigo}</span>
                        </div>
                        <div class="item-body">
                            <p class="item-description">${serv.descripcion || 'Sin descripción'}</p>
                            <div class="item-price">Q${parseFloat(serv.precio_hora).toFixed(2)}/hora</div>
                        </div>
                        <div class="item-footer">
                            <button class="btn btn-sm btn-primary" onclick="agregarAEditEventoCart('servicio', ${serv.id_servicio}, '${serv.nombre_servicio}', ${serv.precio_hora})">
                                <i class="fas fa-plus"></i> Agregar
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = '<p class="text-muted">No hay servicios disponibles</p>';
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function agregarAEditEventoCart(tipo, id, nombre, precio) {
        const existe = editEventoCart.find(item => item.tipo === tipo && item.id === id);
        
        if (existe) {
            existe.cantidad++;
        } else {
            editEventoCart.push({
                tipo: tipo,
                id: id,
                nombre: nombre,
                precio: parseFloat(precio),
                cantidad: 1
            });
        }
        
        renderEditEventoCart();
    }

    async function actualizarEvento() {
        try {
            if (!idEventoEditar) {
                Swal.fire('Error', 'No se pudo identificar el evento', 'error');
                return;
            }
            
            const tipoCliente = document.querySelector('input[name="edit-cliente-tipo"]:checked').value;
            let idCliente = null;
            let nuevoCliente = null;
            
            if (tipoCliente === 'existente') {
                idCliente = document.getElementById('edit-evento-cliente').value;
                if (!idCliente) {
                    Swal.fire('Error', 'Debe seleccionar un cliente', 'error');
                    return;
                }
            } else {
                const nombre = document.getElementById('edit-nuevo-cliente-nombre').value.trim();
                if (!nombre) {
                    Swal.fire('Error', 'Debe ingresar el nombre del cliente', 'error');
                    return;
                }
                nuevoCliente = {
                    nombre: nombre,
                    telefono: document.getElementById('edit-nuevo-cliente-telefono').value.trim(),
                    direccion: document.getElementById('edit-nuevo-cliente-direccion').value.trim(),
                    notas: document.getElementById('edit-nuevo-cliente-notas').value.trim()
                };
            }
            
            if (editEventoCart.length === 0) {
                Swal.fire('Error', 'Debe agregar al menos un artículo o servicio', 'error');
                return;
            }
            
            const eventoData = {
                id_cliente: idCliente,
                nuevo_cliente: nuevoCliente,
                fecha_evento: document.getElementById('edit-evento-fecha').value,
                hora_inicio: document.getElementById('edit-evento-hora-inicio').value,
                hora_fin: document.getElementById('edit-evento-hora-fin').value,
                lugar_evento: document.getElementById('edit-evento-lugar').value.trim(),
                numero_invitados: document.getElementById('edit-evento-invitados').value,
                notas: document.getElementById('edit-evento-notas').value.trim(),
                articulos: editEventoCart.filter(item => item.tipo === 'articulo').map(item => ({
                    id_articulo: item.id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio
                })),
                servicios: editEventoCart.filter(item => item.tipo === 'servicio').map(item => ({
                    id_servicio: item.id,
                    cantidad_horas: item.cantidad,
                    precio_unitario: item.precio
                }))
            };
            
            const response = await fetch(`/api/eventos/${idEventoEditar}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventoData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Evento Actualizado',
                    text: 'El evento se actualizó correctamente'
                });
                closeModal('editarEventoModal');
                limpiarEditEventoModal();
                loadEventos();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Error al actualizar el evento', 'error');
        }
    }

    function limpiarEditEventoModal() {
        editEventoCart = [];
        idEventoEditar = null;
        document.getElementById('editar-evento-form').reset();
        renderEditEventoCart();
    }

    // ─────────────────── VISUALIZAR EVENTO ───────────────────

    async function verDetalleEvento(idEvento) {
        try {
            const response = await fetch(`/api/eventos/${idEvento}`);
            const data = await response.json();
            
            if (!data.success) {
                Swal.fire('Error', 'No se pudo cargar el evento', 'error');
                return;
            }
            
            const evento = data.evento;
            
            // Cargar datos
            document.getElementById('view-evento-cliente').textContent = evento.nombre_cliente || 'Cliente no especificado';
            document.getElementById('view-evento-fecha').textContent = evento.fecha_evento || '-';
            document.getElementById('view-evento-hora-inicio').textContent = evento.hora_inicio || '-';
            document.getElementById('view-evento-hora-fin').textContent = evento.hora_fin || '-';
            document.getElementById('view-evento-lugar').textContent = evento.lugar_evento || '-';
            document.getElementById('view-evento-invitados').textContent = evento.numero_invitados || '-';
            document.getElementById('view-evento-notas').textContent = evento.notas || '-';
            
            // Cargar carrito
            viewEventoCart = [];
            if (evento.articulos) {
                evento.articulos.forEach(art => {
                    viewEventoCart.push({
                        tipo: 'articulo',
                        nombre: art.nombre_articulo,
                        precio: parseFloat(art.precio_unitario),
                        cantidad: parseInt(art.cantidad) || 1
                    });
                });
            }
            if (evento.servicios) {
                evento.servicios.forEach(serv => {
                    viewEventoCart.push({
                        tipo: 'servicio',
                        nombre: serv.nombre_servicio,
                        precio: parseFloat(serv.precio_unitario),
                        cantidad: parseInt(serv.cantidad_horas) || 1
                    });
                });
            }
            
            renderViewEventoCart();
            openModal('visualizarEventoModal');
            
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Error al cargar el evento', 'error');
        }
    }

    function renderViewEventoCart() {
        const tbody = document.getElementById('view-cart-body');
        
        if (viewEventoCart.length === 0) {
            tbody.innerHTML = '<tr class="empty-cart"><td colspan="4" class="text-center text-muted">No hay elementos</td></tr>';
            document.getElementById('view-cart-total').textContent = '0.00';
            return;
        }
        
        let total = 0;
        tbody.innerHTML = viewEventoCart.map(item => {
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
        
        document.getElementById('view-cart-total').textContent = total.toFixed(2);
    }


        document.getElementById('search-eventos')?.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredEventos = eventos.filter(evento => 
            evento.cliente_nombre.toLowerCase().includes(searchTerm) ||
            (evento.lugar_evento && evento.lugar_evento.toLowerCase().includes(searchTerm))
        );
        renderEventosPage(filteredEventos);
    });

       
    document.getElementById('search-articulos-evento')?.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = articulosDisponibles.filter(articulo => {

            const nombre = (articulo.nombre_articulo || '').toLowerCase();
            const codigo = (articulo.codigo || '').toString().toLowerCase();

            return nombre.includes(searchTerm) || codigo.includes(searchTerm);
        });
        
        const grid = document.getElementById('articulos-grid');
        
        if (grid) {
            grid.innerHTML = filtered.map(articulo => `
                <div class="item-card" onclick="addItemToCart('articulo', ${articulo.id_articulo})">
                    <h5>${articulo.nombre_articulo}</h5>
                    <div class="price">Q${parseFloat(articulo.precio_unitario).toFixed(2)}</div>
                    <div class="stock">Stock: ${articulo.cantidad_disponible}</div>
                </div>
            `).join('');
        } else {
            console.error("Error: Contenedor 'articulos-grid' no encontrado.");
        }
    });
