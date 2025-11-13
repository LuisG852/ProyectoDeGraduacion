
// ===============================================
// UTILIDADES
// ===============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-GT');
}

// Función auxiliar que podría no existir - formatDateTimeFull
function formatDateTimeFull(datetime) {
    if (!datetime) return '-';
    const d = new Date(datetime);
    const opciones = {
        timeZone: 'America/Guatemala',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    return new Intl.DateTimeFormat('es-GT', opciones).format(d);
}

    function getEstadoColor(estado) {
        const colores = {
            'reservado': '#FEF3C7',
            'entregado': '#DBEAFE',
            'recogido': '#D1FAE5',
            'con_problemas': '#FEE2E2'
        };
        return colores[estado] || '#F9FAFB';
    }


    // Función auxiliar para obtener color de fondo según estado
    function getEstadoBackgroundColor(estado) {
        const colores = {
            'reservado': '#FEF3C7',
            'pendiente_pago': '#DBEAFE',
            'cancelado': '#FEE2E2'
        };
        return colores[estado] || '#F9FAFB';
    }


        function getColorEstado(estado) {
        const colores = {
            'reservado': '#F59E0B',
            'completado': '#2563EB',
            'cancelado': '#10B981',
            'pendiente_pago': '#3B82F6',  
            'en_preparacion': '#8B5CF6',
            'entregado': '#06B6D4'
        };
        return colores[estado] || '#6B7280';
    }