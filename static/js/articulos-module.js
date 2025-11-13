
    // ===============================================
    // GESTIÓN DE ARTÍCULOS
    // ===============================================
    async function loadArticulos() {
        try {
            const response = await fetch('/api/articulos');
            const data = await response.json();
            
            if (data.success) {
                articulos = data.articulos;
                allArticulos = data.articulos || [];
                
                pagination_articulos.init(allArticulos, (items) => {
                    renderArticulosPage(items);
                });
            }
        } catch (error) {
            console.error('Error loading articulos:', error);
        }
    }

    function renderArticulosPage(articulosActuales) {
        const tbody = document.getElementById('articulos-table-body');
        
        if (articulosActuales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay artículos en esta página</td></tr>';
            return;
        }
        
        tbody.classList.add('table-animated');
        setTimeout(() => tbody.classList.remove('table-animated'), 300);

        tbody.innerHTML = articulosActuales.map(articulo => `
            <tr>
                <td>${articulo.codigo}</td>
                <td>${articulo.nombre_articulo}</td>
                <td>${articulo.categoria_nombre}</td>
                <td>${articulo.cantidad_total}</td>
                <td>${articulo.cantidad_disponible}</td>
                <td>Q${parseFloat(articulo.precio_unitario).toFixed(2)}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarArticulo(${articulo.id_articulo})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }


    async function guardarArticulo() {
        const codigo = document.getElementById('articulo-codigo').value;
        const nombre = document.getElementById('articulo-nombre').value;
        const categoria = document.getElementById('articulo-categoria').value;
        const precio = document.getElementById('articulo-precio').value;
        const cantidad = document.getElementById('articulo-cantidad').value;
        const costo = document.getElementById('articulo-costo').value;
        const descripcion = document.getElementById('articulo-descripcion').value;

        if (!codigo || !nombre || !categoria || !precio || !cantidad) {
            Swal.fire('Error', 'Todos los campos marcados son requeridos', 'error');
            return;
        }

        try {
            const response = await fetch('/api/articulos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    codigo,
                    nombre_articulo: nombre,
                    id_categoria: categoria,
                    precio_unitario: precio,
                    cantidad_total: cantidad,
                    costo_reposicion: costo,
                    descripcion
                })
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire('Éxito', 'Artículo guardado correctamente', 'success');
                closeModal('articuloModal');
                loadArticulos();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error saving articulo:', error);
            Swal.fire('Error', 'Error al guardar artículo', 'error');
        }
    }

    async function editarArticulo(id) {
        try {
            const articulo = articulos.find(a => a.id_articulo === id);
            if (!articulo) {
                Swal.fire('Error', 'Artículo no encontrado', 'error');
                return;
            }

            // Crear modal de edición
            const { value: formValues } = await Swal.fire({
                title: 'Editar Artículo',
                html: `
                    <div style="text-align: left;">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Código</label>
                            <input id="edit-articulo-codigo" class="swal2-input" style="width: 90%; margin: 0;" value="${articulo.codigo}" />
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Nombre</label>
                            <input id="edit-articulo-nombre" class="swal2-input" style="width: 90%; margin: 0;" value="${articulo.nombre_articulo}" />
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Precio Unitario</label>
                            <input id="edit-articulo-precio" type="number" class="swal2-input" style="width: 90%; margin: 0;" value="${articulo.precio_unitario}" step="0.01" />
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Cantidad Total</label>
                            <input id="edit-articulo-cantidad" type="number" class="swal2-input" style="width: 90%; margin: 0;" value="${articulo.cantidad_total}" />
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Descripción</label>
                            <textarea id="edit-articulo-descripcion" class="swal2-textarea" style="width: 90%; margin: 0;">${articulo.descripcion || ''}</textarea>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Actualizar',
                cancelButtonText: 'Cancelar',
                width: '600px',
                preConfirm: () => {
                    const codigo = document.getElementById('edit-articulo-codigo').value;
                    const nombre = document.getElementById('edit-articulo-nombre').value;
                    const precio = document.getElementById('edit-articulo-precio').value;
                    const cantidad = document.getElementById('edit-articulo-cantidad').value;
                    const descripcion = document.getElementById('edit-articulo-descripcion').value;
                    
                    if (!codigo || !nombre || !precio || !cantidad) {
                        Swal.showValidationMessage('Todos los campos son requeridos');
                        return false;
                    }
                    
                    return {
                        codigo,
                        nombre_articulo: nombre,
                        precio_unitario: parseFloat(precio),
                        cantidad_total: parseInt(cantidad),
                        descripcion
                    };
                }
            });

            if (formValues) {
                try {
                    const response = await fetch(`/api/articulos/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formValues)
                    });

                    const data = await response.json();

                    if (data.success) {
                        Swal.fire('Éxito', 'Artículo actualizado correctamente', 'success');
                        loadArticulos();
                    } else {
                        Swal.fire('Error', data.message, 'error');
                    }
                } catch (error) {
                    console.error('Error actualizando artículo:', error);
                    Swal.fire('Error', 'Error al actualizar artículo', 'error');
                }
            }
        } catch (error) {
            console.error('Error en editarArticulo:', error);
            Swal.fire('Error', 'Error al abrir el formulario', 'error');
        }
    }

    // Función para eliminar artículo
    async function eliminarArticulo(id) {
        try {
            // Verificar si el artículo está en uso
            const checkResponse = await fetch(`/api/articulos/${id}/puede-eliminar`);
            const checkData = await checkResponse.json();
            
            let warningMessage = '¿Estás seguro de eliminar este artículo?';
            if (checkData.en_uso) {
                warningMessage = `<div style="text-align: left;">
                    <p><strong>⚠️ Advertencia:</strong></p>
                    <p>Este artículo está siendo utilizado en ${checkData.eventos_count} evento(s).</p>
                    <p style="margin-top: 1rem;">No se recomienda eliminarlo. Considera marcarlo como inactivo en su lugar.</p>
                </div>`;
            }
            
            const result = await Swal.fire({
                title: 'Confirmar Eliminación',
                html: warningMessage,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: checkData.en_uso ? 'Eliminar de todos modos' : 'Sí, eliminar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#EF4444'
            });

            if (result.isConfirmed) {
                const response = await fetch(`/api/articulos/${id}`, { 
                    method: 'DELETE' 
                });
                const data = await response.json();
                
                if (data.success) {
                    Swal.fire('Eliminado', 'Artículo eliminado correctamente', 'success');
                    loadArticulos();
                } else {
                    Swal.fire('Error', data.message, 'error');
                }
            }
        } catch (error) {
            console.error('Error eliminando artículo:', error);
            Swal.fire('Error', 'Error al eliminar artículo', 'error');
        }
    }

    // Event listener para búsqueda de artículos en inventario
    document.getElementById('search-articulos')?.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const categoria = document.getElementById('filter-categoria')?.value;
        
        let filteredArticulos = articulos.filter(articulo => {
            const matchesSearch = articulo.nombre_articulo.toLowerCase().includes(searchTerm) ||
                                  articulo.codigo.toLowerCase().includes(searchTerm) ||
                                  (articulo.descripcion && articulo.descripcion.toLowerCase().includes(searchTerm));
            const matchesCategoria = !categoria || articulo.id_categoria == categoria;
            return matchesSearch && matchesCategoria;
        });
        
        renderArticulosPage(filteredArticulos);
    });

    // Event listener para filtro de categoría
    document.getElementById('filter-categoria')?.addEventListener('change', function(e) {
        const categoria = e.target.value;
        const searchTerm = document.getElementById('search-articulos')?.value.toLowerCase() || '';
        
        let filteredArticulos = articulos.filter(articulo => {
            const matchesSearch = !searchTerm || 
                                  articulo.nombre_articulo.toLowerCase().includes(searchTerm) ||
                                  articulo.codigo.toLowerCase().includes(searchTerm) ||
                                  (articulo.descripcion && articulo.descripcion.toLowerCase().includes(searchTerm));
            const matchesCategoria = !categoria || articulo.id_categoria == categoria;
            return matchesSearch && matchesCategoria;
        });
        
        renderArticulosPage(filteredArticulos);
    });
    document.getElementById('search-articulos-evento')?.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = articulosDisponibles.filter(articulo => 
            articulo.nombre_articulo.toLowerCase().includes(searchTerm) ||
            articulo.codigo.toLowerCase().includes(searchTerm)
        );
        
        const grid = document.getElementById('articulos-grid');
        grid.innerHTML = filtered.map(articulo => `
            <div class="item-card" onclick="addItemToCart('articulo', ${articulo.id_articulo})">
                <h5>${articulo.nombre_articulo}</h5>
                <div class="price">Q${parseFloat(articulo.precio_unitario).toFixed(2)}</div>
                <div class="stock">Stock: ${articulo.cantidad_disponible}</div>
            </div>
        `).join('');
    });