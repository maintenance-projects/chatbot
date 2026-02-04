(function () {
    'use strict';

    var documents = [];
    var allDocuments = [];
    var currentPage = 1;
    var perPage = 10;
    var searchField = 'title';
    var searchQuery = '';
    var sortField = 'date';
    var sortOrder = 'desc';
    var pendingFile = null;
    var confirmCallback = null;
    var isSearchMode = false;
    var activeStatusPopup = null;
    var adminId = '';

    var $ = function (sel) { return document.querySelector(sel); };

    var dom = {
        sidebar: $('#sidebar'),
        sidebarOverlay: $('#sidebarOverlay'),
        btnSidebarToggle: $('#btnSidebarToggle'),
        btnLogout: $('#btnLogout'),
        statTotal: $('#statTotal'),
        statActive: $('#statActive'),
        statToday: $('#statToday'),
        statInactive: $('#statInactive'),
        searchField: $('#searchField'),
        searchInput: $('#searchInput'),
        btnSearch: $('#btnSearch'),
        sortField: $('#sortField'),
        btnSort: $('#btnSort'),
        sortIconSvg: $('#sortIconSvg'),
        sortLabel: $('#sortLabel'),
        btnAddDoc: $('#btnAddDoc'),
        tableBody: $('#docTableBody'),
        tableInfo: $('#tableInfo'),
        pagination: $('#pagination'),
        perPageSelect: $('#perPageSelect'),
        loadingOverlay: $('#loadingOverlay'),
        docModal: $('#docModal'),
        docModalTitle: $('#docModalTitle'),
        docModalClose: $('#docModalClose'),
        docModalCancel: $('#docModalCancel'),
        docModalSave: $('#docModalSave'),
        docUploader: $('#docUploader'),
        fileInput: $('#fileInput'),
        fileUploadArea: $('#fileUploadArea'),
        fileUploadGroup: $('#fileUploadGroup'),
        filePreviewWrap: $('#filePreviewWrap'),
        confirmModal: $('#confirmModal'),
        confirmTitle: $('#confirmTitle'),
        confirmMsg: $('#confirmMsg'),
        confirmCancel: $('#confirmCancel'),
        confirmOk: $('#confirmOk'),
        toastContainer: $('#toastContainer'),
        userName: $('#userName'),
        userAvatar: $('#userAvatar')
    };

    function getAdminId() {
        adminId = sessionStorage.getItem('userId') || '';
        return adminId;
    }

    function formatBytes(bytes) {
        var b = parseInt(bytes, 10);
        if (isNaN(b) || b === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getExtFromFileName(name) {
        if (!name) return '';
        var parts = name.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    function getFileTypeClass(ext) {
        ext = (ext || '').toLowerCase();
        if (ext === 'pdf') return 'pdf';
        if (ext === 'doc' || ext === 'docx') return 'doc';
        if (ext === 'xls' || ext === 'xlsx') return 'xls';
        if (ext === 'ppt' || ext === 'pptx') return 'ppt';
        if (ext === 'txt') return 'txt';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].indexOf(ext) !== -1) return 'img';
        return 'etc';
    }

    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function showLoading(on) {
        dom.loadingOverlay.classList.toggle('show', on);
    }

    function toast(msg, type) {
        type = type || 'info';
        var iconMap = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        var el = document.createElement('div');
        el.className = 'toast ' + type;
        el.innerHTML =
            '<span class="toast-icon">' + (iconMap[type] || iconMap.info) + '</span>' +
            '<span class="toast-text">' + escapeHtml(msg) + '</span>' +
            '<button class="toast-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        dom.toastContainer.appendChild(el);
        var close = el.querySelector('.toast-close');
        var remove = function () {
            el.classList.add('removing');
            setTimeout(function () { el.remove(); }, 250);
        };
        close.addEventListener('click', remove);
        setTimeout(remove, 3500);
    }

    function animateNumber(el, target) {
        var current = parseInt(el.textContent) || 0;
        if (current === target) { el.textContent = target; return; }
        var diff = target - current;
        var steps = 12;
        var step = 0;
        var timer = setInterval(function () {
            step++;
            el.textContent = Math.round(current + diff * (step / steps));
            if (step >= steps) { el.textContent = target; clearInterval(timer); }
        }, 25);
    }

    function renderStats() {
        var total = allDocuments.length;
        var active = 0;
        var inactive = 0;
        var todayStr = new Date().toISOString().substring(0, 10);
        var todayCount = 0;
        for (var i = 0; i < allDocuments.length; i++) {
            if (allDocuments[i].isUse) active++; else inactive++;
            if (allDocuments[i].registDate === todayStr) todayCount++;
        }
        animateNumber(dom.statTotal, total);
        animateNumber(dom.statActive, active);
        animateNumber(dom.statToday, todayCount);
        animateNumber(dom.statInactive, inactive);
    }

    function sortDocuments(list) {
        var sorted = list.slice();
        sorted.sort(function (a, b) {
            var valA, valB;
            if (sortField === 'title') {
                valA = (a.fileName || '').toLowerCase();
                valB = (b.fileName || '').toLowerCase();
            } else {
                valA = a.registDate || '';
                valB = b.registDate || '';
            }
            var cmp = 0;
            if (valA < valB) cmp = -1;
            else if (valA > valB) cmp = 1;
            return sortOrder === 'asc' ? cmp : -cmp;
        });
        return sorted;
    }

    function renderTable() {
        closeStatusPopup();
        var sorted = sortDocuments(documents);
        var totalItems = sorted.length;
        var totalPagesCalc = Math.max(1, Math.ceil(totalItems / perPage));
        if (currentPage > totalPagesCalc) currentPage = totalPagesCalc;

        var start = (currentPage - 1) * perPage;
        var pageData = sorted.slice(start, start + perPage);

        if (pageData.length === 0) {
            dom.tableBody.innerHTML =
                '<tr><td colspan="8">' +
                '<div class="empty-state">' +
                '<div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
                '<div class="empty-state-title">문서가 없습니다</div>' +
                '<div class="empty-state-desc">' + (searchQuery ? '검색 결과가 없습니다. 다른 키워드로 검색해보세요.' : '새로운 문서를 추가해주세요.') + '</div>' +
                '</div></td></tr>';
        } else {
            var html = '';
            for (var i = 0; i < pageData.length; i++) {
                var doc = pageData[i];
                var rowNum = start + i + 1;
                var ext = getExtFromFileName(doc.fileName);
                var typeClass = getFileTypeClass(ext);
                var extLabel = ext ? ext.toUpperCase() : '-';
                var statusClass = doc.isUse ? 'active' : 'inactive';
                var statusLabel = doc.isUse ? '활성' : '비활성';

                html +=
                    '<tr data-key="' + escapeHtml(doc.key) + '">' +
                    '<td class="center" style="color:var(--text-light);font-size:0.82rem;">' + rowNum + '</td>' +
                    '<td>' +
                    '<div class="file-name-cell">' +
                    '<div class="file-icon ' + typeClass + '">' + escapeHtml(extLabel.substring(0, 4)) + '</div>' +
                    '<div class="file-meta">' +
                    '<div class="file-title" title="' + escapeHtml(doc.fileName) + '">' + escapeHtml(doc.fileName) + '</div>' +
                    '</div></div></td>' +
                    '<td class="center" style="text-transform:uppercase;color:var(--text-mid);font-size:0.82rem;">' + escapeHtml(ext || '-') + '</td>' +
                    '<td class="center" style="color:var(--text-mid);font-size:0.82rem;">' + formatBytes(doc.length) + '</td>' +
                    '<td class="center">' + escapeHtml(doc.adminName) + '</td>' +
                    '<td class="center" style="font-size:0.82rem;color:var(--text-mid);font-variant-numeric:tabular-nums;">' + escapeHtml(doc.registDate) + '</td>' +
                    '<td class="center"><div class="status-cell" style="position:relative;"><span class="badge ' + statusClass + ' badge-clickable" data-key="' + escapeHtml(doc.key) + '" data-current="' + (doc.isUse ? 'true' : 'false') + '">' + statusLabel + '</span></div></td>' +
                    '<td class="center">' +
                    '<div class="action-btns">' +
                    '<button class="btn-icon danger" title="삭제" data-delete-key="' + escapeHtml(doc.key) + '" data-delete-name="' + escapeHtml(doc.fileName) + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                    '</button>' +
                    '</div></td></tr>';
            }
            dom.tableBody.innerHTML = html;
        }

        if (totalItems === 0) {
            dom.tableInfo.innerHTML = '총 <strong>0</strong>건';
        } else {
            dom.tableInfo.innerHTML = '총 <strong>' + totalItems + '</strong>건 중 <strong>' + (start + 1) + '</strong>-<strong>' + Math.min(start + perPage, totalItems) + '</strong>';
        }

        renderPagination(totalPagesCalc);
    }

    function renderPagination(totalPagesCalc) {
        var html = '';
        html += '<button class="page-btn"' + (currentPage <= 1 ? ' disabled' : '') + ' data-page="' + (currentPage - 1) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>';

        var pages = getPaginationRange(currentPage, totalPagesCalc);
        for (var i = 0; i < pages.length; i++) {
            var p = pages[i];
            if (p === '...') {
                html += '<span class="page-ellipsis">…</span>';
            } else {
                html += '<button class="page-btn' + (p === currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
            }
        }

        html += '<button class="page-btn"' + (currentPage >= totalPagesCalc ? ' disabled' : '') + ' data-page="' + (currentPage + 1) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>';

        dom.pagination.innerHTML = html;
    }

    function getPaginationRange(current, total) {
        if (total <= 7) {
            var arr = [];
            for (var i = 1; i <= total; i++) arr.push(i);
            return arr;
        }
        var pages = [];
        if (current <= 4) {
            for (var a = 1; a <= 5; a++) pages.push(a);
            pages.push('...', total);
        } else if (current >= total - 3) {
            pages.push(1, '...');
            for (var b = total - 4; b <= total; b++) pages.push(b);
        } else {
            pages.push(1, '...');
            for (var c = current - 1; c <= current + 1; c++) pages.push(c);
            pages.push('...', total);
        }
        return pages;
    }

    function fetchList() {
        showLoading(true);
        var id = getAdminId();
        var formData = new FormData();
        formData.append('adminId', id);
        formData.append('size', 10);
        formData.append('page', 1);

        fetch('/admin/storage/list', {
            method: 'POST',
            body: formData
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                allDocuments = Array.isArray(data) ? data : [];
                documents = allDocuments.slice();
                isSearchMode = false;
                renderStats();
                renderTable();
                showLoading(false);
            })
            .catch(function (err) {
                console.error('fetchList error:', err);
                toast('문서 목록을 불러오는데 실패했습니다.', 'error');
                showLoading(false);
            });
    }

    function fetchSearch() {
        var query = dom.searchInput.value.trim();
        if (!query) {
            isSearchMode = false;
            documents = allDocuments.slice();
            currentPage = 1;
            renderTable();
            return;
        }

        showLoading(true);
        var id = getAdminId();
        var type = dom.searchField.value;
        var formData = new FormData();
        formData.append('adminId', id);
        formData.append('type', type);
        formData.append('context', query);
        formData.append('size', 9999);
        formData.append('page', 0);

        fetch('/admin/storage/search', {
            method: 'POST',
            body: formData
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                documents = Array.isArray(data) ? data : [];
                isSearchMode = true;
                searchQuery = query;
                currentPage = 1;
                renderTable();
                showLoading(false);
            })
            .catch(function (err) {
                console.error('fetchSearch error:', err);
                toast('검색에 실패했습니다.', 'error');
                showLoading(false);
            });
    }

    function uploadFile() {
        if (!pendingFile) {
            toast('파일을 선택해주세요.', 'error');
            return;
        }

        showLoading(true);
        dom.docModalSave.disabled = true;

        var id = getAdminId();
        var formData = new FormData();
        formData.append('adminId', id);
        formData.append('file', pendingFile);

        fetch('/admin/storage/add', {
            method: 'POST',
            body: formData
        })
            .then(function (res) { return res.text(); })
            .then(function (data) {
                dom.docModalSave.disabled = false;
                if (data.trim() === 'ok') {
                    toast('문서가 추가되었습니다.', 'success');
                    closeDocModal();
                    fetchList();
                } else {
                    toast('문서 추가에 실패했습니다.', 'error');
                    showLoading(false);
                }
            })
            .catch(function (err) {
                dom.docModalSave.disabled = false;
                console.error('uploadFile error:', err);
                toast('문서 추가 중 오류가 발생했습니다.', 'error');
                showLoading(false);
            });
    }

    function deleteFile(key, fileName) {
        openConfirm(
            '문서를 삭제하시겠습니까?',
            '"' + fileName + '" 문서를 삭제하면 복구할 수 없습니다.',
            function () {
                showLoading(true);
                var id = getAdminId();
                var formData = new FormData();
                formData.append('adminId', id);
                formData.append('key', key);

                fetch('/admin/storage/delete', {
                    method: 'POST',
                    body: formData
                })
                    .then(function (res) { return res.text(); })
                    .then(function (data) {
                        closeConfirm();
                        if (data.trim() === 'ok') {
                            toast('문서가 삭제되었습니다.', 'success');
                            fetchList();
                        } else {
                            toast('문서 삭제에 실패했습니다.', 'error');
                            showLoading(false);
                        }
                    })
                    .catch(function (err) {
                        closeConfirm();
                        console.error('deleteFile error:', err);
                        toast('문서 삭제 중 오류가 발생했습니다.', 'error');
                        showLoading(false);
                    });
            }
        );
    }

    function toggleUsage(key, newIsUse) {
        showLoading(true);
        var id = getAdminId();
        var formData = new FormData();
        formData.append('adminId', id);
        formData.append('key', key);
        formData.append('isUse', newIsUse);

        fetch('/admin/storage/usage', {
            method: 'POST',
            body: formData
        })
            .then(function (res) { return res.text(); })
            .then(function (data) {
                closeStatusPopup();
                if (data.trim() === 'ok') {
                    toast('상태가 변경되었습니다.', 'success');
                    for (var i = 0; i < allDocuments.length; i++) {
                        if (allDocuments[i].key === key) {
                            allDocuments[i].isUse = newIsUse;
                            break;
                        }
                    }
                    for (var j = 0; j < documents.length; j++) {
                        if (documents[j].key === key) {
                            documents[j].isUse = newIsUse;
                            break;
                        }
                    }
                    renderStats();
                    renderTable();
                } else {
                    toast('상태 변경에 실패했습니다.', 'error');
                }
                showLoading(false);
            })
            .catch(function (err) {
                closeStatusPopup();
                console.error('toggleUsage error:', err);
                toast('상태 변경 중 오류가 발생했습니다.', 'error');
                showLoading(false);
            });
    }

    function openDocModal() {
        dom.docModalTitle.textContent = '문서 추가';
        dom.docUploader.value = getAdminId();
        pendingFile = null;
        dom.fileInput.value = '';
        dom.filePreviewWrap.innerHTML = '';
        dom.docModal.classList.add('show');
    }

    function closeDocModal() {
        dom.docModal.classList.remove('show');
        pendingFile = null;
    }

    function openConfirm(title, msg, cb) {
        dom.confirmTitle.textContent = title;
        dom.confirmMsg.textContent = msg;
        confirmCallback = cb;
        dom.confirmModal.classList.add('show');
    }

    function closeConfirm() {
        dom.confirmModal.classList.remove('show');
        confirmCallback = null;
    }

    function handleFileSelect(file) {
        if (!file) return;
        pendingFile = file;
        dom.filePreviewWrap.innerHTML =
            '<div class="file-preview">' +
            '<span class="file-preview-name">' + escapeHtml(file.name) + '</span>' +
            '<span class="file-preview-size">' + formatBytes(file.size) + '</span>' +
            '<button class="file-preview-remove" type="button" id="removeFileBtn">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button></div>';
        $('#removeFileBtn').addEventListener('click', function () {
            pendingFile = null;
            dom.fileInput.value = '';
            dom.filePreviewWrap.innerHTML = '';
        });
    }

    function showStatusPopup(badgeEl, key, currentIsUse) {
        closeStatusPopup();
        var popup = document.createElement('div');
        popup.className = 'status-popup';

        var isActive = currentIsUse === 'true' || currentIsUse === true;

        popup.innerHTML =
            '<div class="status-popup-title">상태 변경</div>' +
            '<button class="status-popup-btn' + (isActive ? ' current' : '') + '" data-value="true">' +
            '<span class="badge active" style="pointer-events:none;">활성</span>' +
            (isActive ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
            '</button>' +
            '<button class="status-popup-btn' + (!isActive ? ' current' : '') + '" data-value="false">' +
            '<span class="badge inactive" style="pointer-events:none;">비활성</span>' +
            (!isActive ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
            '</button>';

        var cell = badgeEl.closest('.status-cell');
        cell.appendChild(popup);
        activeStatusPopup = popup;

        requestAnimationFrame(function () {
            popup.classList.add('show');
        });

        popup.addEventListener('click', function (e) {
            var btn = e.target.closest('.status-popup-btn');
            if (!btn) return;
            var newVal = btn.getAttribute('data-value') === 'true';
            if (newVal === isActive) {
                closeStatusPopup();
                return;
            }
            toggleUsage(key, newVal);
        });
    }

    function closeStatusPopup() {
        if (activeStatusPopup) {
            activeStatusPopup.remove();
            activeStatusPopup = null;
        }
    }

    function updateSortUI() {
        if (sortOrder === 'asc') {
            dom.sortIconSvg.innerHTML = '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>';
            dom.sortLabel.textContent = '오름차순';
        } else {
            dom.sortIconSvg.innerHTML = '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>';
            dom.sortLabel.textContent = '내림차순';
        }
    }

    function bindEvents() {
        dom.btnSidebarToggle.addEventListener('click', function () {
            dom.sidebar.classList.toggle('open');
            dom.sidebarOverlay.classList.toggle('show');
        });
        dom.sidebarOverlay.addEventListener('click', function () {
            dom.sidebar.classList.remove('open');
            dom.sidebarOverlay.classList.remove('show');
        });

        dom.btnLogout.addEventListener('click', function () {
            sessionStorage.removeItem('userId');
            window.location.href = '/admin';
        });

        dom.btnSearch.addEventListener('click', function () {
            currentPage = 1;
            fetchSearch();
        });
        dom.searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                currentPage = 1;
                fetchSearch();
            }
        });
        dom.searchInput.addEventListener('input', function () {
            if (dom.searchInput.value.trim() === '' && isSearchMode) {
                isSearchMode = false;
                searchQuery = '';
                documents = allDocuments.slice();
                currentPage = 1;
                renderTable();
            }
        });

        dom.sortField.addEventListener('change', function () {
            sortField = dom.sortField.value;
            currentPage = 1;
            renderTable();
        });
        dom.btnSort.addEventListener('click', function () {
            sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
            updateSortUI();
            currentPage = 1;
            renderTable();
        });

        dom.perPageSelect.addEventListener('change', function () {
            perPage = parseInt(dom.perPageSelect.value);
            currentPage = 1;
            renderTable();
        });

        dom.pagination.addEventListener('click', function (e) {
            var btn = e.target.closest('.page-btn');
            if (!btn || btn.disabled || btn.classList.contains('active')) return;
            var page = parseInt(btn.getAttribute('data-page'));
            if (isNaN(page) || page < 1) return;
            currentPage = page;
            renderTable();
        });

        dom.tableBody.addEventListener('click', function (e) {
            var deleteBtn = e.target.closest('[data-delete-key]');
            if (deleteBtn) {
                var key = deleteBtn.getAttribute('data-delete-key');
                var name = deleteBtn.getAttribute('data-delete-name');
                deleteFile(key, name);
                return;
            }

            var badge = e.target.closest('.badge-clickable');
            if (badge) {
                var bKey = badge.getAttribute('data-key');
                var bCurrent = badge.getAttribute('data-current');
                showStatusPopup(badge, bKey, bCurrent);
                return;
            }
        });

        document.addEventListener('click', function (e) {
            if (activeStatusPopup && !e.target.closest('.status-popup') && !e.target.closest('.badge-clickable')) {
                closeStatusPopup();
            }
        });

        dom.btnAddDoc.addEventListener('click', openDocModal);
        dom.docModalClose.addEventListener('click', closeDocModal);
        dom.docModalCancel.addEventListener('click', closeDocModal);
        dom.docModal.addEventListener('click', function (e) { if (e.target === dom.docModal) closeDocModal(); });
        dom.docModalSave.addEventListener('click', uploadFile);

        dom.confirmCancel.addEventListener('click', closeConfirm);
        dom.confirmModal.addEventListener('click', function (e) { if (e.target === dom.confirmModal) closeConfirm(); });
        dom.confirmOk.addEventListener('click', function () { if (confirmCallback) confirmCallback(); });

        dom.fileInput.addEventListener('change', function (e) { handleFileSelect(e.target.files[0]); });
        dom.fileUploadArea.addEventListener('dragover', function (e) { e.preventDefault(); dom.fileUploadArea.classList.add('dragover'); });
        dom.fileUploadArea.addEventListener('dragleave', function () { dom.fileUploadArea.classList.remove('dragover'); });
        dom.fileUploadArea.addEventListener('drop', function (e) {
            e.preventDefault();
            dom.fileUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if (activeStatusPopup) { closeStatusPopup(); return; }
                if (dom.confirmModal.classList.contains('show')) { closeConfirm(); return; }
                if (dom.docModal.classList.contains('show')) { closeDocModal(); return; }
            }
        });
    }

    function init() {
        window.checkSession();
        getAdminId();
        bindEvents();
        updateSortUI();
        fetchList();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();