// ===============================================
// GESTIÓN DE EMPLEADOS
// ===============================================
let empleados = [];
let allEmpleados = [];
let pagination_empleados = null;

// Inicializar la paginación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Crear instancia de paginación si existe la clase
    if (typeof Pagination !== 'undefined') {
        pagination_empleados = new Pagination('pagination-empleados', 10);
    }
});

async function loadEmpleados() {
    try {
        const response = await fetch('/api/empleados');
        const data = await response.json();
        
        if (data.success) {
            empleados = data.empleados;
            allEmpleados = data.empleados || [];
            
            // Usar paginación si está disponible
            if (pagination_empleados) {
                pagination_empleados.init(allEmpleados, (items) => {
                    renderEmpleadosPage(items);
                });
            } else {
                renderEmpleadosPage(allEmpleados);
            }
        }
    } catch (error) {
        console.error('Error loading empleados:', error);
        Swal.fire('Error', 'Error cargando empleados', 'error');
    }
}

function renderEmpleadosPage(empleadosList) {
    const tbody = document.getElementById('empleados-table-body');
    
    if (!tbody) {
        console.warn('Elemento empleados-table-body no encontrado');
        return;
    }
    
    if (empleadosList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay empleados registrados</td></tr>';
        return;
    }
    
    tbody.classList.add('table-animated');
    setTimeout(() => tbody.classList.remove('table-animated'), 300);

    tbody.innerHTML = empleadosList.map(empleado => `
        <tr>
            <td>${empleado.nombre}</td>
            <td>${empleado.cargo || '-'}</td>
            <td>${empleado.telefono || '-'}</td>
            <td>${empleado.email || '-'}</td>
            <td>${empleado.fecha_ingreso ? new Date(empleado.fecha_ingreso).toLocaleDateString() : '-'}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editarEmpleado(${empleado.id_empleado})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="eliminarEmpleado(${empleado.id_empleado})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function guardarEmpleado() {
    const nombre = document.getElementById('empleado-nombre').value;
    const cargo = document.getElementById('empleado-cargo').value;
    const telefono = document.getElementById('empleado-telefono').value;
    const direccion = document.getElementById('empleado-direccion').value;
    const email = document.getElementById('empleado-email').value;
    const username = document.getElementById('empleado-username').value;
    const password = document.getElementById('empleado-password').value;
    
    if (!nombre.trim()) {
        Swal.fire('Error', 'El nombre es requerido', 'error');
        return;
    }
    
    if (!email.trim() || !username.trim() || !password.trim()) {
        Swal.fire('Error', 'Email, usuario y contraseña son requeridos', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/empleados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, cargo, telefono, direccion, email, username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            Swal.fire('Éxito', 'Empleado guardado correctamente', 'success');
            closeModal('empleadoModal');
            loadEmpleados();
            // Limpiar formulario
            document.getElementById('empleado-nombre').value = '';
            document.getElementById('empleado-cargo').value = '';
            document.getElementById('empleado-telefono').value = '';
            document.getElementById('empleado-direccion').value = '';
            document.getElementById('empleado-email').value = '';
            document.getElementById('empleado-username').value = '';
            document.getElementById('empleado-password').value = '';
        } else {
            Swal.fire('Error', data.message, 'error');
        }
    } catch (error) {
        console.error('Error saving empleado:', error);
        Swal.fire('Error', 'Error al guardar empleado', 'error');
    }
}

async function editarEmpleado(id) {
    try {
        const empleado = empleados.find(e => e.id_empleado === id);
        if (!empleado) {
            Swal.fire('Error', 'Empleado no encontrado', 'error');
            return;
        }

        document.getElementById('edit-empleado-id').value = empleado.id_empleado;
        document.getElementById('edit-empleado-nombre').value = empleado.nombre;
        document.getElementById('edit-empleado-cargo').value = empleado.cargo || '';
        document.getElementById('edit-empleado-telefono').value = empleado.telefono || '';
        document.getElementById('edit-empleado-direccion').value = empleado.direccion || '';
        document.getElementById('edit-empleado-email').value = empleado.email || '';
        document.getElementById('edit-empleado-username').value = empleado.username || '';

        openModal('editarEmpleadoModal');
    } catch (error) {
        console.error('Error loading empleado for edit:', error);
        Swal.fire('Error', 'Error cargando datos del empleado', 'error');
    }
}

async function actualizarEmpleado() {
    const id = document.getElementById('edit-empleado-id').value;
    const nombre = document.getElementById('edit-empleado-nombre').value;
    const cargo = document.getElementById('edit-empleado-cargo').value;
    const telefono = document.getElementById('edit-empleado-telefono').value;
    const direccion = document.getElementById('edit-empleado-direccion').value;
    const email = document.getElementById('edit-empleado-email').value;
    const username = document.getElementById('edit-empleado-username').value;
    const password = document.getElementById('edit-empleado-password').value;

    if (!nombre.trim()) {
        Swal.fire('Error', 'El nombre es requerido', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/empleados/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, cargo, telefono, direccion, email, username, password })
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire('Éxito', 'Empleado actualizado correctamente', 'success');
            closeModal('editarEmpleadoModal');
            loadEmpleados();
        } else {
            Swal.fire('Error', data.message, 'error');
        }
    } catch (error) {
        console.error('Error updating empleado:', error);
        Swal.fire('Error', 'Error al actualizar empleado', 'error');
    }
}

async function eliminarEmpleado(id) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esta acción eliminará el empleado y su usuario asociado',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/empleados/${id}`, { method: 'DELETE' });
            const data = await response.json();
            
            if (data.success) {
                Swal.fire('Eliminado', 'Empleado eliminado correctamente', 'success');
                loadEmpleados();
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting empleado:', error);
            Swal.fire('Error', 'Error al eliminar empleado', 'error');
        }
    }
}

// Búsqueda de empleados
document.addEventListener('DOMContentLoaded', function() {
    const searchEmpleados = document.getElementById('search-empleados');
    if (searchEmpleados) {
        searchEmpleados.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const filteredEmpleados = allEmpleados.filter(empleado => 
                empleado.nombre.toLowerCase().includes(searchTerm) ||
                (empleado.cargo && empleado.cargo.toLowerCase().includes(searchTerm)) ||
                (empleado.email && empleado.email.toLowerCase().includes(searchTerm))
            );
            
            // Usar paginación si está disponible
            if (pagination_empleados) {
                pagination_empleados.init(filteredEmpleados, (items) => {
                    renderEmpleadosPage(items);
                });
            } else {
                renderEmpleadosPage(filteredEmpleados);
            }
        });
    }
});