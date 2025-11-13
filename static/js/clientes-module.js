    // ===============================================
    // GESTIÓN DE CLIENTES
    // ===============================================
    async function loadClientes() {
        try {
            const response = await fetch('/api/clientes');
            const data = await response.json();
            
            if (data.success) {
                clientes = data.clientes;
                allClientes = data.clientes || [];
                
                pagination_clientes.init(allClientes, (items) => {
                    renderClientesPage(items);
                });
                
                populateClienteSelect();
            }
        } catch (error) {
            console.error('Error loading clientes:', error);
            Swal.fire('Error', 'Error cargando clientes', 'error');
        }
    }

    function renderClientesPage(clientesList) {
        const tbody = document.getElementById('clientes-table-body');
        
        if (clientesList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay clientes en esta página</td></tr>';
            return;
        }
        
        tbody.classList.add('table-animated');
        setTimeout(() => tbody.classList.remove('table-animated'), 300);

        tbody.innerHTML = clientesList.map(cliente => `
            <tr>
                <td>${cliente.nombre}</td>
                <td>${cliente.telefono || '-'}</td>
                <td>${cliente.direccion || '-'}</td>
                <td>0</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarCliente(${cliente.id_cliente})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarCliente(${cliente.id_cliente})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function populateClienteSelect() {
        const selects = ['evento-cliente', 'cotizacion-cliente', 'edit-evento-cliente'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Seleccionar cliente...</option>' +
                    clientes.map(cliente => `<option value="${cliente.id_cliente}">${cliente.nombre}</option>`).join('');
            }
        });
    }

    async function guardarCliente() {
        const nombre = document.getElementById('cliente-nombre').value;
        const telefono = document.getElementById('cliente-telefono').value;
        const direccion = document.getElementById('cliente-direccion').value;
        const notas = document.getElementById('cliente-notas').value;
        
        if (!nombre.trim()) {
            Swal.fire('Error', 'El nombre es requerido', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, telefono, direccion, notas })
            });
            
            const data = await response.json();
            
            if (data.success) {
                Swal.fire('Éxito', 'Cliente guardado correctamente', 'success');
                closeModal('clienteModal');
                loadClientes();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error saving cliente:', error);
            Swal.fire('Error', 'Error al guardar cliente', 'error');
        }
    }

    async function editarCliente(id) {
        try {
            const cliente = clientes.find(c => c.id_cliente === id);
            if (!cliente) {
                Swal.fire('Error', 'Cliente no encontrado', 'error');
                return;
            }

            document.getElementById('edit-cliente-id').value = cliente.id_cliente;
            document.getElementById('edit-cliente-nombre').value = cliente.nombre;
            document.getElementById('edit-cliente-telefono').value = cliente.telefono || '';
            document.getElementById('edit-cliente-direccion').value = cliente.direccion || '';
            document.getElementById('edit-cliente-notas').value = cliente.notas || '';

            openModal('editarClienteModal');
        } catch (error) {
            console.error('Error loading cliente for edit:', error);
            Swal.fire('Error', 'Error cargando datos del cliente', 'error');
        }
    }

    async function actualizarCliente() {
        const id = document.getElementById('edit-cliente-id').value;
        const nombre = document.getElementById('edit-cliente-nombre').value;
        const telefono = document.getElementById('edit-cliente-telefono').value;
        const direccion = document.getElementById('edit-cliente-direccion').value;
        const notas = document.getElementById('edit-cliente-notas').value;

        if (!nombre.trim()) {
            Swal.fire('Error', 'El nombre es requerido', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/clientes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, telefono, direccion, notas })
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire('Éxito', 'Cliente actualizado correctamente', 'success');
                closeModal('editarClienteModal');
                loadClientes();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error updating cliente:', error);
            Swal.fire('Error', 'Error al actualizar cliente', 'error');
        }
    }

    async function eliminarCliente(id) {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
                const data = await response.json();
                
                if (data.success) {
                    Swal.fire('Eliminado', 'Cliente eliminado correctamente', 'success');
                    loadClientes();
                } else {
                    Swal.fire('Error', data.message, 'error');
                }
            } catch (error) {
                console.error('Error deleting cliente:', error);
                Swal.fire('Error', 'Error al eliminar cliente', 'error');
            }
        }
    }

    function toggleClienteForm(tipo) {
        const existenteSection = document.getElementById('cliente-existente-section');
        const nuevoSection = document.getElementById('cliente-nuevo-section');
        
        if (tipo === 'existente') {
            existenteSection.classList.remove('hidden');
            nuevoSection.classList.add('hidden');
            
            document.getElementById('nuevo-cliente-nombre').value = '';
            document.getElementById('nuevo-cliente-telefono').value = '';
            document.getElementById('nuevo-cliente-direccion').value = '';
            document.getElementById('nuevo-cliente-notas').value = '';
        } else {
            existenteSection.classList.add('hidden');
            nuevoSection.classList.remove('hidden');
            
            document.getElementById('evento-cliente').value = '';
        }
    }

        document.getElementById('search-clientes')?.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredClientes = clientes.filter(cliente => 
            cliente.nombre.toLowerCase().includes(searchTerm) ||
            (cliente.telefono && cliente.telefono.toLowerCase().includes(searchTerm))
        );
        renderClientesPage(filteredClientes);
    });