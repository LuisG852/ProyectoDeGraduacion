    // ===============================================
    // PERFIL
    // ===============================================
    async function loadPerfilData() {
        try {
            const response = await fetch('/api/perfil');
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('perfil-nombre').value = data.perfil.nombre || '';
                document.getElementById('perfil-email').value = data.perfil.email || '';
                document.getElementById('perfil-telefono').value = data.perfil.telefono || '';
                document.getElementById('perfil-cargo').value = data.perfil.cargo || '';
                document.getElementById('perfil-direccion').value = data.perfil.direccion || '';
            }
        } catch (error) {
            console.error('Error loading perfil data:', error);
        }
    }
