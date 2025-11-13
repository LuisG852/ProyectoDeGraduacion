  // ──────────────────────────────────────────────────────────────────
    // CLASE PAGINACIÓN UNIVERSAL
    // ────────────────────────────────────────────────────────────────── 

    class Pagination {
        constructor(containerId, itemsPerPageDefault = 10) {
            this.containerId = containerId;
            this.currentPage = 1;
            this.itemsPerPage = itemsPerPageDefault;
            this.totalItems = 0;
            this.allItems = [];
            this.onPageChange = null;
        }

        init(items, onPageChangeCallback) {
            this.allItems = items;
            this.totalItems = items.length;
            this.onPageChange = onPageChangeCallback;
            this.currentPage = 1;
            this.render();
            this.updateDisplay();
        }

        getTotalPages() {
            return Math.ceil(this.totalItems / this.itemsPerPage);
        }

        getCurrentPageItems() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            return this.allItems.slice(start, end);
        }

        goToPage(pageNumber) {
            const totalPages = this.getTotalPages();
            if (pageNumber < 1 || pageNumber > totalPages) return;
            
            this.currentPage = pageNumber;
            this.updateDisplay();
            this.render();
        }

        changeItemsPerPage(newItemsPerPage) {
            this.itemsPerPage = parseInt(newItemsPerPage);
            this.currentPage = 1;
            this.updateDisplay();
            this.render();
        }

        updateDisplay() {
            if (this.onPageChange) {
                const currentItems = this.getCurrentPageItems();
                this.onPageChange(currentItems);
            }
        }

        render() {
            const container = document.getElementById(this.containerId);
            if (!container) return;

            const totalPages = this.getTotalPages();
            
            if (this.totalItems === 0 || totalPages <= 1) {
                container.style.display = 'none';
                return;
            }
            
            container.style.display = 'flex';

            const start = (this.currentPage - 1) * this.itemsPerPage + 1;
            const end = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);

            let html = `
                <div class="pagination-info">
                    <i class="fas fa-info-circle"></i>
                    <span>Mostrando ${start} - ${end} de ${this.totalItems}</span>
                </div>
                
                <div class="pagination-buttons">
                    <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                            onclick="pagination_${this.containerId.replace('pagination-', '')}.goToPage(${this.currentPage - 1})">
                        <span><i class="fas fa-chevron-left"></i></span>
                    </button>
                    
                    ${this.generatePageButtons()}
                    
                    <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} 
                            onclick="pagination_${this.containerId.replace('pagination-', '')}.goToPage(${this.currentPage + 1})">
                        <span><i class="fas fa-chevron-right"></i></span>
                    </button>
                </div>

                <div class="items-per-page">
                    <label for="items-select-${this.containerId}">Por página:</label>
                    <select id="items-select-${this.containerId}" 
                            onchange="pagination_${this.containerId.replace('pagination-', '')}.changeItemsPerPage(this.value)">
                        <option value="5" ${this.itemsPerPage === 5 ? 'selected' : ''}>5</option>
                        <option value="10" ${this.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                        <option value="20" ${this.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                        <option value="50" ${this.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                    </select>
                </div>
            `;

            container.innerHTML = html;
        }

        generatePageButtons() {
            const totalPages = this.getTotalPages();
            let buttons = '';
            
            const maxButtons = 7;
            let startPage = 1;
            let endPage = totalPages;

            if (totalPages > maxButtons) {
                const halfMax = Math.floor(maxButtons / 2);
                
                if (this.currentPage <= halfMax) {
                    endPage = maxButtons - 1;
                } else if (this.currentPage >= totalPages - halfMax) {
                    startPage = totalPages - maxButtons + 2;
                } else {
                    startPage = this.currentPage - halfMax + 1;
                    endPage = this.currentPage + halfMax - 1;
                }
            }

            if (startPage > 1) {
                buttons += `
                    <button class="pagination-btn ${this.currentPage === 1 ? 'active' : ''}" 
                            onclick="pagination_${this.containerId.replace('pagination-', '')}.goToPage(1)">
                        <span>1</span>
                    </button>
                `;
                if (startPage > 2) {
                    buttons += '<span class="pagination-ellipsis">...</span>';
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                buttons += `
                    <button class="pagination-btn ${this.currentPage === i ? 'active' : ''}" 
                            onclick="pagination_${this.containerId.replace('pagination-', '')}.goToPage(${i})">
                        <span>${i}</span>
                    </button>
                `;
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    buttons += '<span class="pagination-ellipsis">...</span>';
                }
                buttons += `
                    <button class="pagination-btn ${this.currentPage === totalPages ? 'active' : ''}" 
                            onclick="pagination_${this.containerId.replace('pagination-', '')}.goToPage(${totalPages})">
                        <span>${totalPages}</span>
                    </button>
                `;
            }

            return buttons;
        }
    }