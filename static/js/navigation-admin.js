    // ===============================================
    // 3. NAVEGACIÓN Y UI
    // ===============================================
    function setupMenuNavigation() {
        const menuLinks = document.querySelectorAll('.menu-link[data-section]');
        
        menuLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const sectionId = this.getAttribute('data-section');
                
                menuLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                
                showSection(sectionId);
                loadSectionData(sectionId);
            });
        });
    }

    function showSection(sectionId) {
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => section.classList.remove('active'));
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }

    function loadSectionData(sectionId) {
        switch(sectionId) {
            case 'inicio':
                loadDashboardDataAdmin();
                break;
            case 'eventos':
                loadEventos();
                break;
            case 'cotizaciones':
                loadCotizaciones();
                break;
            case 'articulos':
                loadArticulos();
                break;
            case 'clientes':
                loadClientes();
                break;
            case 'empleados':
                loadEmpleados();
                break;
            case 'gestion-articulos':
                loadEventosConArticulos();
                break;
            case 'perfil':
                loadPerfilData();
                break;
            case 'reportes':
                loadReportesStats();
                break;
        }
    }