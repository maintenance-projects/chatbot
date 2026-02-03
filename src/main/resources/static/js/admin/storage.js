(function () {
    'use strict';

    const SAMPLE_DATA = (() => {
        const names = ['김나영', '이동규', '백귀현', '김현준', '권세리', '전수은', '조문석', '김찬호', '박희영', '설주희'];
        const titles = [
            '고객 서비스 FAQ 매뉴얼', '제품 사용 가이드 v2.1', '2024년 상반기 보고서',
            '챗봇 시나리오 설계 문서', '기술 지원 응대 스크립트', '신규 입사자 교육 자료',
            'API 연동 가이드라인', '개인정보 처리 방침 최신본', '마케팅 캠페인 분석 결과',
            '시스템 장애 대응 매뉴얼', '고객 만족도 조사 리포트', '보안 정책 가이드',
            '서비스 이용약관 개정안', '파트너사 제휴 안내문', '월간 운영 현황 보고서',
            '데이터 백업 절차서', 'UI/UX 디자인 가이드', '챗봇 성능 테스트 결과',
            '내부 커뮤니케이션 지침', '연간 사업 계획서', '고객 불만 처리 가이드',
            '서버 모니터링 매뉴얼', '결제 시스템 연동 문서', 'QA 테스트 체크리스트',
            '법률 자문 요약 보고서', '인사 평가 기준 문서', '예산 집행 현황표',
            '업무 프로세스 개선안', '고객 피드백 분석 보고', '재해 복구 계획서',
            '신기능 기획서 (v3.0)', '외부 감사 결과 보고서', '영업 전략 문서',
            '클라우드 마이그레이션 계획', '보안 점검 체크리스트'
        ];
        const extensions = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'doc', 'xls', 'png', 'jpg'];
        const statuses = ['active', 'active', 'active', 'active', 'inactive', 'pending'];
        const descs = [
            '챗봇에서 자주 참조되는 주요 문서입니다.',
            '최신 업데이트 반영 완료.',
            '검토 후 활성화 예정.',
            '정기 업데이트가 필요한 문서.',
            ''
        ];

        const data = [];
        for (let i = 0; i < titles.length; i++) {
            const ext = extensions[Math.floor(Math.random() * extensions.length)];
            const sizeKB = Math.floor(Math.random() * 10000) + 50;
            const daysAgo = Math.floor(Math.random() * 120);
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            data.push({
                id: i + 1,
                title: titles[i],
                fileName: titles[i].replace(/[\s\/]/g, '_') + '.' + ext,
                ext: ext,
                size: sizeKB * 1024,
                uploader: names[Math.floor(Math.random() * names.length)],
                date: date.toISOString(),
                status: statuses[Math.floor(Math.random() * statuses.length)],
                description: descs[Math.floor(Math.random() * descs.length)]
            });
        }
        return data;
    })();

    let documents = JSON.parse(JSON.stringify(SAMPLE_DATA));
    let currentPage = 1;
    let perPage = 10;
    let searchField = 'all';
    let searchQuery = '';
    let selectedIds = new Set();
    let editingId = null;
    let pendingFile = null;
    let confirmCallback = null;
    let nextId = documents.length + 1;

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        sidebar: $('#sidebar'),
        sidebarOverlay: $('#sidebarOverlay'),
        btnSidebarToggle: $('#btnSidebarToggle'),
        btnLogout: $('#btnLogout'),
        topbarTime: $('#topbarTime'),
        statTotal: $('#statTotal'),
        statActive: $('#statActive'),
        statToday: $('#statToday'),
        statInactive: $('#statInactive'),
        searchField: $('#searchField'),
        searchInput: $('#searchInput'),
        btnSearch: $('#btnSearch'),
        btnAddDoc: $('#btnAddDoc'),
        btnBulkDelete: $('#btnBulkDelete'),
        checkAll: $('#checkAll'),
        tableBody: $('#docTableBody'),
        tableInfo: $('#tableInfo'),
        pagination: $('#pagination'),
        perPageSelect: $('#perPageSelect'),
        loadingOverlay: $('#loadingOverlay'),
        // modal
        docModal: $('#docModal'),
        docModalTitle: $('#docModalTitle'),
        docModalClose: $('#docModalClose'),
        docModalCancel: $('#docModalCancel'),
        docModalSave: $('#docModalSave'),
        docTitle: $('#docTitle'),
        docUploader: $('#docUploader'),
        docStatus: $('#docStatus'),
        docDesc: $('#docDesc'),
        fileInput: $('#fileInput'),
        fileUploadArea: $('#fileUploadArea'),
        fileUploadGroup: $('#fileUploadGroup'),
        filePreviewWrap: $('#filePreviewWrap'),
        // confirm
        confirmModal: $('#confirmModal'),
        confirmTitle: $('#confirmTitle'),
        confirmMsg: $('#confirmMsg'),
        confirmCancel: $('#confirmCancel'),
        confirmOk: $('#confirmOk'),
        // toast
        toastContainer: $('#toastContainer'),
        // user
        userName: $('#userName'),
        userAvatar: $('#userAvatar'),
    };

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatDate(iso) {
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    }

    function getFileTypeClass(ext) {
        ext = ext.toLowerCase();
        if (['pdf'].includes(ext)) return 'pdf';
        if (['doc', 'docx'].includes(ext)) return 'doc';
        if (['xls', 'xlsx'].includes(ext)) return 'xls';
        if (['ppt', 'pptx'].includes(ext)) return 'ppt';
        if (['txt'].includes(ext)) return 'txt';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'img';
        return 'etc';
    }

    function getStatusLabel(status) {
        const map = { active: '활성', inactive: '비활성', pending: '대기' };
        return map[status] || status;
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function getFilteredDocs() {
        if (!searchQuery.trim()) return documents;
        const q = searchQuery.trim().toLowerCase();
        return documents.filter(doc => {
            if (searchField === 'title') return doc.title.toLowerCase().includes(q);
            if (searchField === 'uploader') return doc.uploader.toLowerCase().includes(q);
            if (searchField === 'type') return doc.ext.toLowerCase().includes(q);
            // all
            return doc.title.toLowerCase().includes(q) ||
                doc.uploader.toLowerCase().includes(q) ||
                doc.ext.toLowerCase().includes(q) ||
                (doc.description && doc.description.toLowerCase().includes(q));
        });
    }

    function renderStats() {
        const total = documents.length;
        const active = documents.filter(d => d.status === 'active').length;
        const inactive = documents.filter(d => d.status === 'inactive').length;
        const today = new Date().toDateString();
        const todayCount = documents.filter(d => new Date(d.date).toDateString() === today).length;

        animateNumber(dom.statTotal, total);
        animateNumber(dom.statActive, active);
        animateNumber(dom.statToday, todayCount);
        animateNumber(dom.statInactive, inactive);
    }

    function animateNumber(el, target) {
        const current = parseInt(el.textContent) || 0;
        if (current === target) { el.textContent = target; return; }
        const diff = target - current;
        const steps = 12;
        let step = 0;
        const timer = setInterval(() => {
            step++;
            const val = Math.round(current + diff * (step / steps));
            el.textContent = val;
            if (step >= steps) { el.textContent = target; clearInterval(timer); }
        }, 25);
    }

    function renderTable() {
        const filtered = getFilteredDocs();
        const totalItems = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * perPage;
        const pageData = filtered.slice(start, start + perPage);

        // Rows
        if (pageData.length === 0) {
            dom.tableBody.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="empty-state">
                            <div class="empty-state-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </div>
                            <div class="empty-state-title">문서가 없습니다</div>
                            <div class="empty-state-desc">${searchQuery ? '검색 결과가 없습니다. 다른 키워드로 검색해보세요.' : '새로운 문서를 추가해주세요.'}</div>
                        </div>
                    </td>
                </tr>`;
        } else {
            let html = '';
            pageData.forEach((doc, idx) => {
                const rowNum = totalItems - start - idx;
                const checked = selectedIds.has(doc.id) ? 'checked' : '';
                const selected = selectedIds.has(doc.id) ? ' selected' : '';
                const typeClass = getFileTypeClass(doc.ext);
                html += `
                <tr class="${selected}" data-id="${doc.id}">
                    <td class="center" style="color:var(--text-light);font-size:0.82rem;">${rowNum}</td>
                    <td>
                        <div class="file-name-cell">
                            <div class="file-icon ${typeClass}">${escapeHtml(doc.ext.toUpperCase().substring(0, 4))}</div>
                            <div class="file-meta">
                                <div class="file-title" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</div>
                                <div class="file-sub">${escapeHtml(doc.fileName)}</div>
                            </div>
                        </div>
                    </td>
                    <td class="center" style="text-transform:uppercase;color:var(--text-mid);font-size:0.82rem;">${escapeHtml(doc.ext)}</td>
                    <td class="center" style="color:var(--text-mid);font-size:0.82rem;">${formatBytes(doc.size)}</td>
                    <td class="center" >${escapeHtml(doc.uploader)}</td>
                    <td class="center" style="font-size:0.82rem;color:var(--text-mid);font-variant-numeric:tabular-nums;">${formatDate(doc.date)}</td>
                    <td class="center"><span class="badge ${doc.status}">${getStatusLabel(doc.status)}</span></td>
                    <td class="center">
                        <div class="action-btns">
                            <button class="btn-icon" title="수정" onclick="StorageApp.editDoc(${doc.id})">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="btn-icon danger" title="삭제" onclick="StorageApp.deleteDoc(${doc.id})">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>`;
            });
            dom.tableBody.innerHTML = html;
        }

        if (totalItems === 0) {
            dom.tableInfo.innerHTML = '총 <strong>0</strong>건';
        } else {
            dom.tableInfo.innerHTML = `총 <strong>${totalItems}</strong>건 중 <strong>${start + 1}</strong>-<strong>${Math.min(start + perPage, totalItems)}</strong>`;
        }

        dom.btnBulkDelete.style.display = selectedIds.size > 0 ? '' : 'none';
        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        let html = '';
        // Prev
        html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="StorageApp.goPage(${currentPage - 1})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>`;

        const pages = getPaginationRange(currentPage, totalPages);
        pages.forEach(p => {
            if (p === '...') {
                html += '<span class="page-ellipsis">…</span>';
            } else {
                html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="StorageApp.goPage(${p})">${p}</button>`;
            }
        });

        // Next
        html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="StorageApp.goPage(${currentPage + 1})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>`;

        dom.pagination.innerHTML = html;
    }

    function getPaginationRange(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages = [];
        if (current <= 4) {
            for (let i = 1; i <= 5; i++) pages.push(i);
            pages.push('...', total);
        } else if (current >= total - 3) {
            pages.push(1, '...');
            for (let i = total - 4; i <= total; i++) pages.push(i);
        } else {
            pages.push(1, '...');
            for (let i = current - 1; i <= current + 1; i++) pages.push(i);
            pages.push('...', total);
        }
        return pages;
    }

    function openDocModal(mode, doc) {
        editingId = doc ? doc.id : null;
        dom.docModalTitle.textContent = mode === 'edit' ? '문서 수정' : '문서 추가';
        dom.docTitle.value = doc ? doc.title : '';
        dom.docUploader.value = doc ? doc.uploader : '';
        dom.docStatus.value = doc ? doc.status : 'active';
        dom.docDesc.value = doc ? doc.description || '' : '';
        pendingFile = null;
        dom.filePreviewWrap.innerHTML = '';
        dom.fileUploadGroup.style.display = mode === 'edit' ? 'none' : '';
        dom.docModal.classList.add('show');
        setTimeout(() => dom.docTitle.focus(), 200);
    }

    function closeDocModal() {
        dom.docModal.classList.remove('show');
        editingId = null;
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

    function saveDoc() {
        const title = dom.docTitle.value.trim();
        const uploader = dom.docUploader.value.trim();
        const status = dom.docStatus.value;
        const desc = dom.docDesc.value.trim();

        if (!title) { toast('문서명을 입력해주세요.', 'error'); dom.docTitle.focus(); return; }
        if (!uploader) { toast('등록자를 입력해주세요.', 'error'); dom.docUploader.focus(); return; }

        showLoading(true);

        setTimeout(() => {
            if (editingId) {
                // Edit
                const doc = documents.find(d => d.id === editingId);
                if (doc) {
                    doc.title = title;
                    doc.uploader = uploader;
                    doc.status = status;
                    doc.description = desc;
                }
                toast('문서가 수정되었습니다.', 'success');
            } else {
                // Add
                let ext = 'pdf';
                let size = 0;
                let fileName = title.replace(/[\s\/]/g, '_') + '.pdf';
                if (pendingFile) {
                    fileName = pendingFile.name;
                    ext = fileName.split('.').pop() || 'etc';
                    size = pendingFile.size;
                } else {
                    size = Math.floor(Math.random() * 5000000) + 50000;
                }
                documents.unshift({
                    id: nextId++,
                    title,
                    fileName,
                    ext,
                    size,
                    uploader,
                    date: new Date().toISOString(),
                    status,
                    description: desc,
                });
                toast('문서가 추가되었습니다.', 'success');
            }

            closeDocModal();
            renderStats();
            renderTable();
            showLoading(false);
        }, 400);
    }

    function deleteSingle(id) {
        const doc = documents.find(d => d.id === id);
        if (!doc) return;
        openConfirm(
            '문서를 삭제하시겠습니까?',
            `"${doc.title}" 문서를 삭제하면 복구할 수 없습니다.`,
            () => {
                showLoading(true);
                setTimeout(() => {
                    documents = documents.filter(d => d.id !== id);
                    selectedIds.delete(id);
                    closeConfirm();
                    renderStats();
                    renderTable();
                    showLoading(false);
                    toast('문서가 삭제되었습니다.', 'success');
                }, 300);
            }
        );
    }

    function deleteBulk() {
        if (selectedIds.size === 0) return;
        openConfirm(
            `${selectedIds.size}건의 문서를 삭제하시겠습니까?`,
            '선택된 문서를 모두 삭제하면 복구할 수 없습니다.',
            () => {
                showLoading(true);
                setTimeout(() => {
                    documents = documents.filter(d => !selectedIds.has(d.id));
                    selectedIds.clear();
                    closeConfirm();
                    renderStats();
                    renderTable();
                    showLoading(false);
                    toast('선택된 문서가 삭제되었습니다.', 'success');
                }, 300);
            }
        );
    }

    function toast(msg, type = 'info') {
        const iconMap = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `
            <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
            <span class="toast-text">${escapeHtml(msg)}</span>
            <button class="toast-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
        dom.toastContainer.appendChild(el);

        const close = el.querySelector('.toast-close');
        const remove = () => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 250);
        };
        close.addEventListener('click', remove);
        setTimeout(remove, 3500);
    }

    function showLoading(on) {
        dom.loadingOverlay.classList.toggle('show', on);
    }

    function updateClock() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const day = days[now.getDay()];
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
    }

    function handleFileSelect(file) {
        if (!file) return;
        pendingFile = file;
        dom.filePreviewWrap.innerHTML = `
            <div class="file-preview">
                <span class="file-preview-name">${escapeHtml(file.name)}</span>
                <span class="file-preview-size">${formatBytes(file.size)}</span>
                <button class="file-preview-remove" type="button" id="removeFileBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>`;
        $('#removeFileBtn').addEventListener('click', () => {
            pendingFile = null;
            dom.fileInput.value = '';
            dom.filePreviewWrap.innerHTML = '';
        });
    }

    function bindEvents() {
        dom.btnSidebarToggle.addEventListener('click', () => {
            dom.sidebar.classList.toggle('open');
            dom.sidebarOverlay.classList.toggle('show');
        });
        dom.sidebarOverlay.addEventListener('click', () => {
            dom.sidebar.classList.remove('open');
            dom.sidebarOverlay.classList.remove('show');
        });

        dom.btnLogout.addEventListener('click', () => {
            sessionStorage.removeItem('userId');
            window.location.href = '/admin';
        });

        dom.btnSearch.addEventListener('click', doSearch);
        dom.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
        dom.searchField.addEventListener('change', () => { searchField = dom.searchField.value; });

        dom.perPageSelect.addEventListener('change', () => {
            perPage = parseInt(dom.perPageSelect.value);
            currentPage = 1;
            renderTable();
        });

        dom.tableBody.addEventListener('change', e => {
            if (e.target.classList.contains('row-check')) {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
                renderTable();
            }
        });

        dom.btnBulkDelete.addEventListener('click', deleteBulk);
        dom.btnAddDoc.addEventListener('click', () => openDocModal('add'));
        dom.docModalClose.addEventListener('click', closeDocModal);
        dom.docModalCancel.addEventListener('click', closeDocModal);
        dom.docModal.addEventListener('click', e => { if (e.target === dom.docModal) closeDocModal(); });
        dom.docModalSave.addEventListener('click', saveDoc);

        dom.confirmCancel.addEventListener('click', closeConfirm);
        dom.confirmModal.addEventListener('click', e => { if (e.target === dom.confirmModal) closeConfirm(); });
        dom.confirmOk.addEventListener('click', () => { if (confirmCallback) confirmCallback(); });

        dom.fileInput.addEventListener('change', e => handleFileSelect(e.target.files[0]));
        dom.fileUploadArea.addEventListener('dragover', e => { e.preventDefault(); dom.fileUploadArea.classList.add('dragover'); });
        dom.fileUploadArea.addEventListener('dragleave', () => dom.fileUploadArea.classList.remove('dragover'));
        dom.fileUploadArea.addEventListener('drop', e => {
            e.preventDefault();
            dom.fileUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (dom.confirmModal.classList.contains('show')) closeConfirm();
                else if (dom.docModal.classList.contains('show')) closeDocModal();
            }
        });
    }

    function doSearch() {
        searchField = dom.searchField.value;
        searchQuery = dom.searchInput.value;
        currentPage = 1;
        selectedIds.clear();
        renderTable();
    }

    window.StorageApp = {
        goPage(page) {
            const filtered = getFilteredDocs();
            const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
            if (page < 1 || page > totalPages) return;
            currentPage = page;
            renderTable();
        },
        editDoc(id) {
            const doc = documents.find(d => d.id === id);
            if (doc) openDocModal('edit', doc);
        },
        deleteDoc(id) {
            deleteSingle(id);
        }
    };

    function init() {
        window.checkSession();
        bindEvents();
        renderStats();
        renderTable();
        updateClock();
        setInterval(updateClock, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();