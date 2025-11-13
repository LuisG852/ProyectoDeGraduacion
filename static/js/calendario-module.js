 // ===============================================
    // CALENDARIO
    // ===============================================
    async function loadEventosDelMes(year, month) {
        try {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            
            const fechaInicio = firstDay.toISOString().split('T')[0];
            const fechaFin = lastDay.toISOString().split('T')[0];
            
            const response = await fetch(`/api/eventos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
            const data = await response.json();
            
            if (data.success) {
                eventosDelMes = data.eventos;
            } else {
                eventosDelMes = [];
            }
        } catch (error) {
            console.error('Error cargando eventos del mes:', error);
            eventosDelMes = [];
        }
    }

    async function generateCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        document.getElementById('mes-actual').textContent = `${monthNames[month]} ${year}`;
        
        const calendarGrid = document.getElementById('calendar-grid');
        const loadingDiv = document.getElementById('calendar-loading');
        loadingDiv.style.display = 'flex';
        calendarGrid.style.opacity = '0.5';
        
        await loadEventosDelMes(year, month);
        
        loadingDiv.style.display = 'none';
        calendarGrid.style.opacity = '1';
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        calendarGrid.innerHTML = '';
        
        const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < 42; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            
            if (currentDay.getMonth() !== month) {
                dayElement.classList.add('other-month');
            }
            
            const checkDate = new Date(currentDay);
            checkDate.setHours(0, 0, 0, 0);
            if (checkDate.getTime() === today.getTime()) {
                dayElement.classList.add('today');
            }
            
            const dayEvents = getEventosDelDia(currentDay);
            
            if (dayEvents.length > 0) {
                dayElement.classList.add('has-events');
            }
            
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = currentDay.getDate();
            dayElement.appendChild(dayNumber);
            
            if (dayEvents.length > 0) {
                const eventsContainer = document.createElement('div');
                eventsContainer.className = 'calendar-events';
                
                dayEvents.forEach(evento => {
                    const eventItem = document.createElement('div');
                    eventItem.className = `calendar-event-item estado-${evento.estado}`;
                    eventItem.onclick = (e) => {
                        e.stopPropagation();
                        verEventoDesdeCalendario(evento.id_evento);
                    };
                    
                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'event-time';
                    timeSpan.textContent = evento.hora_inicio ? evento.hora_inicio.substring(0, 5) : '';
                    
                    const clientSpan = document.createElement('span');
                    clientSpan.className = 'event-client';
                    clientSpan.textContent = evento.cliente_nombre || 'Sin cliente';
                    
                    eventItem.appendChild(timeSpan);
                    eventItem.appendChild(clientSpan);
                    eventsContainer.appendChild(eventItem);
                });
                
                dayElement.appendChild(eventsContainer);
                
                if (dayEvents.length > 3) {
                    const countBadge = document.createElement('div');
                    countBadge.className = 'events-count';
                    countBadge.textContent = dayEvents.length;
                    dayElement.appendChild(countBadge);
                }
            }
            
            dayElement.onclick = () => selectDate(currentDay);
            
            calendarGrid.appendChild(dayElement);
        }
    }

    function getEventosDelDia(date) {
        const dateString = date.toISOString().split('T')[0];
        return eventosDelMes.filter(evento => {
            const eventoDate = evento.fecha_evento.split('T')[0];
            return eventoDate === dateString;
        });
    }

    function cambiarMes(direction) {
        currentDate.setMonth(currentDate.getMonth() + direction);
        generateCalendar();
    }

    function irAHoy() {
        currentDate = new Date();
        generateCalendar();
    }

    function selectDate(date) {
        selectedDate = date;
        
        const dayEvents = getEventosDelDia(date);
        
        if (dayEvents.length > 0) {
            mostrarEventosDelDia(date, dayEvents);
        } else {
            document.getElementById('evento-fecha').value = date.toISOString().split('T')[0];
            openModal('eventoModal');
        }
    }

    function mostrarEventosDelDia(date, eventos) {
        const dateString = date.toLocaleDateString('es-GT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const eventosHtml = eventos.map(evento => `
            <div class="evento-dia-item" style="padding: 1rem; border-left: 4px solid ${getColorEstado(evento.estado)}; background: #f8f9fa; border-radius: 8px; margin-bottom: 1rem; cursor: pointer;" onclick="verEventoDesdeCalendario(${evento.id_evento})">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                            ${evento.cliente_nombre || 'Sin cliente'}
                        </h4>
                        <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.875rem; color: var(--text-secondary);">
                            <span><i class="fas fa-clock"></i> ${evento.hora_inicio || '--:--'} - ${evento.hora_fin || '--:--'}</span>
                            ${evento.lugar_evento ? `<span><i class="fas fa-map-marker-alt"></i> ${evento.lugar_evento}</span>` : ''}
                            ${evento.numero_invitados ? `<span><i class="fas fa-users"></i> ${evento.numero_invitados} invitados</span>` : ''}
                        </div>
                    </div>
                    <span class="status-badge status-${evento.estado}">${evento.estado}</span>
                </div>
                ${evento.notas ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-secondary);">${evento.notas}</p>` : ''}
            </div>
        `).join('');
        
        Swal.fire({
            title: `📅 Eventos del ${dateString}`,
            html: `
                <div style="text-align: left; max-height: 500px; overflow-y: auto;">
                    ${eventosHtml}
                </div>
                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="Swal.close(); document.getElementById('evento-fecha').value = '${date.toISOString().split('T')[0]}'; openModal('eventoModal');">
                        <i class="fas fa-plus"></i> Agregar evento este día
                    </button>
                </div>
            `,
            width: '800px',
            showConfirmButton: false,
            showCloseButton: true
        });
    }



    async function verEventoDesdeCalendario(eventoId) {
        Swal.close();
        await verEvento(eventoId);
    }
