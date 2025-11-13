    // ===============================================
    // 1. VARIABLES GLOBALES
    // ===============================================
    let currentDate = new Date();
    let selectedDate = null;
    
    // Datos principales
    let clientes = [];
    let eventos = [];
    let articulos = [];
    let eventosDelMes = [];
    let eventosGestion = [];

    // Datos para gestión de artículos
    let articulosGestionActual = [];
    let eventoGestionActual = null;

    // Carritos y datos temporales
    let eventoCart = [];
    let cotizacionesData = [];
    let editEventoCart = [];
    let viewEventoCart = [];
    let editCotizacionCart = [];
    let viewCotizacionCart = [];

    // Artículos y servicios disponibles
    let articulosDisponibles = [];
    let serviciosDisponibles = [];

    // IDs de edición
    let cotizacionActualId = null;
    let idEventoEditar = null;
    let idCotizacionEditar = null;

    // Instancias de paginación
    let pagination_cotizaciones = null;
    let pagination_eventos = null;
    let pagination_clientes = null;
    let pagination_articulos = null;

    // Arrays para paginación
    let allCotizaciones = [];
    let allEventos = [];
    let allClientes = [];
    let allArticulos = [];

    // Variables globales para cotización
    let cotizacionCart = [];
    let articulosDataCot = [];
    let serviciosDataCot = [];
    let articulosLoadedCot = false;
    let serviciosLoadedCot = false;

    //Reportes
    let articulosSeleccionadosReporte = [];
