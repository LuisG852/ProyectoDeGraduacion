document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupMenuNavigation();
    loadDashboardData();
    initializePagination();
});

function initializeDashboard() {
    // Usar la variable global que pasaste desde HTML
    const nombreEmpleado = window.userData?.name || 'Empleado';
    document.getElementById('empleado-nombre').textContent = nombreEmpleado;
    generateCalendar();
}

function initializePagination() {
    pagination_cotizaciones = new Pagination('pagination-cotizaciones', 10);
    pagination_eventos = new Pagination('pagination-eventos', 10);
    pagination_clientes = new Pagination('pagination-clientes', 10);
    pagination_articulos = new Pagination('pagination-articulos', 10);
}