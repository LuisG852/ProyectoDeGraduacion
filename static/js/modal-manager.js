    // ===============================================
    // MODALES
    // ===============================================
    function openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
        
        if (modalId === 'eventoModal') {
            eventoCart = [];
            renderCart();
            
            document.getElementById('articulos-section').classList.add('hidden');
            document.getElementById('servicios-section').classList.add('hidden');
            document.getElementById('toggleArticulos').checked = false;
            document.getElementById('toggleServicios').checked = false;
            
            loadClientes();
            
            document.getElementById('evento-form').reset();
            document.querySelector('input[name="cliente-tipo"][value="existente"]').checked = true;
            toggleClienteForm('existente');
        }
        
        if (modalId === 'cotizacionModal') {
            // Solo limpiar si es nueva cotización (no edición)
            if (!cotizacionActualId) {
                cotizacionCart = [];
                document.getElementById('cotizacion-form-completa').reset();
            }
            
            renderCotizacionCart();
            
            // Solo ocultar secciones si es nueva
            if (!cotizacionActualId) {
                document.getElementById('articulos-section-cot').classList.add('hidden');
                document.getElementById('servicios-section-cot').classList.add('hidden');
                document.getElementById('toggleArticulosCot').checked = false;
                document.getElementById('toggleServiciosCot').checked = false;
            }
            
            loadClientes();
            
            // Cargar artículos y servicios disponibles
            loadArticulosParaCotizacion();
            loadServiciosParaCotizacion();
        }
    }

    function closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        
        const form = document.querySelector(`#${modalId} form`);
        if (form) {
            form.reset();
        }
        
        // Limpiar ID de cotización en edición
        if (modalId === 'cotizacionModal') {

            articulosSeleccionadosReporte = [];
            console.log('🧹 Selección de artículos limpiada');
            cotizacionActualId = null;
            
            // Restaurar botón a "Guardar" en lugar de "Actualizar"
            const saveButton = document.querySelector('#cotizacionModal .modal-footer .btn-primary');
            if (saveButton) {
                saveButton.innerHTML = '<i class="fas fa-save"></i> Guardar Cotización';
                saveButton.onclick = guardarCotizacionCompleta;
            }
        }
    }

    window.onclick = function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }