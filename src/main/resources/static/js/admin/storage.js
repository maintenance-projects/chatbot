(function () {
    "use strict";

    var documents = [];
    var currentPage = 1;
    var perPage = 10;
    var searchField = "fileName";
    var searchQuery = "";
    var sortField = "registDate";
    var sortOrder = "desc";
    var pendingFiles = [];
    var confirmCallback = null;
    var isSearchMode = false;
    var activeStatusPopup = null;
    var adminId = "";

    var paging = {
        totalItems: null,
        totalPages: null,
        hasMore: true,
        lastFetchCount: 0,
        headersTotal: null,
        maxKnownPage: 0,
        endReachedAt: null
    };

    var ui = {
        blockSize: 7,
        pageBlockStart: 1
    };

    var cache = {
        list: {},
        search: {}
    };

    var $ = function (sel) {
        return document.querySelector(sel);
    };

    var dom = {
        sidebar: $("#sidebar"),
        sidebarOverlay: $("#sidebarOverlay"),
        btnSidebarToggle: $("#btnSidebarToggle"),
        btnLogout: $("#btnLogout"),
        statTotal: $("#statTotal"),
        statActive: $("#statActive"),
        statToday: $("#statToday"),
        statInactive: $("#statInactive"),
        searchField: $("#searchField"),
        searchInput: $("#searchInput"),
        btnSearch: $("#btnSearch"),
        sortField: $("#sortField"),
        btnSort: $("#btnSort"),
        sortIconSvg: $("#sortIconSvg"),
        sortLabel: $("#sortLabel"),
        btnAddDoc: $("#btnAddDoc"),
        tableBody: $("#docTableBody"),
        tableInfo: $("#tableInfo"),
        pagination: $("#pagination"),
        perPageSelect: $("#perPageSelect"),
        loadingOverlay: $("#loadingOverlay"),
        docModal: $("#docModal"),
        docModalTitle: $("#docModalTitle"),
        docModalClose: $("#docModalClose"),
        docModalCancel: $("#docModalCancel"),
        docModalSave: $("#docModalSave"),
        docUploader: $("#docUploader"),
        fileInput: $("#fileInput"),
        fileUploadArea: $("#fileUploadArea"),
        fileUploadGroup: $("#fileUploadGroup"),
        filePreviewWrap: $("#filePreviewWrap"),
        confirmModal: $("#confirmModal"),
        confirmTitle: $("#confirmTitle"),
        confirmMsg: $("#confirmMsg"),
        confirmCancel: $("#confirmCancel"),
        confirmOk: $("#confirmOk"),
        toastContainer: $("#toastContainer"),
        userName: $("#userName"),
        userAvatar: $("#userAvatar"),
        btnScreenGuide: $("#btnScreenGuide"),
        screenGuideOverlay: $("#screenGuideOverlay"),
        screenGuideDim: $("#screenGuideDim"),
        screenGuideClose: $("#btnCloseScreenGuide"),
        screenGuideLayer: $("#screenGuideHighlightLayer")
    };

    var guideItems = [
        { selector: ".stats-row", title: "요약 카드", text: "전체/오늘/활성/비활성 문서 현황을 확인합니다." },
        { selector: ".search-group", title: "문서 검색", text: "문서명/등록자 기준으로 원하는 문서를 빠르게 찾습니다." },
        { selector: ".sort-group", title: "정렬", text: "문서명 또는 등록일 기준으로 오름/내림 정렬을 변경합니다." },
        { selector: "#btnAddDoc", title: "문서 추가", text: "파일을 업로드해 문서 지식을 즉시 추가합니다." },
        { selector: ".table-wrap", title: "문서 목록", text: "문서 상태 변경과 삭제를 포함한 관리 작업을 수행합니다." },
        { selector: "#pagination", title: "페이지 이동", text: "페이지 블록 단위로 이동하며 목록을 탐색합니다." }
    ];
    var isScreenGuideOpen = false;

    function normalizeSortField(v) {
        var s = String(v || "").trim();
        if (s === "fileName") return "fileName";
        if (s === "registDate") return "registDate";
        return "registDate";
    }

    function getOrderType() {
        var sf = normalizeSortField(sortField);
        return sf === "fileName" ? "fileName" : "registDate";
    }

    function syncSortSelectUI() {
        if (!dom.sortField) return;
        dom.sortField.value = normalizeSortField(sortField);
    }

    function getAdminId() {
        adminId = sessionStorage.getItem("userId") || sessionStorage.getItem("adminId") || "";
        return adminId;
    }

    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function formatDateYYYYMMDD(input) {
        if (input == null) return "";
        var s = String(input).trim();
        if (!s) return "";

        if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
            var p1 = s.split(" ")[0].split("T")[0].split("-");
            return p1[0] + "-" + pad2(p1[1]) + "-" + pad2(p1[2]);
        }
        if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(s)) {
            var p2 = s.split(" ")[0].split("T")[0].split("/");
            return p2[0] + "-" + pad2(p2[1]) + "-" + pad2(p2[2]);
        }
        if (/^\d{8}$/.test(s)) {
            return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
        }

        var dt = new Date(s);
        if (!isNaN(dt.getTime())) {
            return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate());
        }
        return s.length >= 10 ? s.substring(0, 10) : s;
    }

    function formatBytes(bytes) {
        var b = parseInt(bytes, 10);
        if (isNaN(b) || b === 0) return "0 B";
        var k = 1024;
        var sizes = ["B", "KB", "MB", "GB"];
        var i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }

    function getExtFromFileName(name) {
        if (!name) return "";
        var parts = name.split(".");
        return parts.length > 1 ? parts.pop().toLowerCase() : "";
    }

    function getFileTypeClass(ext) {
        ext = (ext || "").toLowerCase();
        if (ext === "pdf") return "pdf";
        if (ext === "doc" || ext === "docx") return "doc";
        if (ext === "xls" || ext === "xlsx") return "xls";
        if (ext === "ppt" || ext === "pptx") return "ppt";
        if (ext === "txt") return "txt";
        if (["png", "jpg", "jpeg", "gif", "webp", "svg"].indexOf(ext) !== -1) return "img";
        return "etc";
    }

    function escapeHtml(str) {
        var d = document.createElement("div");
        d.textContent = str || "";
        return d.innerHTML;
    }

    function showLoading(on) {
        if (!dom.loadingOverlay) return;
        dom.loadingOverlay.classList.toggle("show", on);
    }

    function toast(msg, type) {
        type = type || "info";
        if (!dom.toastContainer) return;

        var iconMap = {
            success:
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error:
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info:
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        var el = document.createElement("div");
        el.className = "toast " + type;
        el.innerHTML =
            '<span class="toast-icon">' +
            (iconMap[type] || iconMap.info) +
            "</span>" +
            '<span class="toast-text">' +
            escapeHtml(msg) +
            "</span>" +
            '<button class="toast-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';

        dom.toastContainer.appendChild(el);

        var close = el.querySelector(".toast-close");
        var remove = function () {
            el.classList.add("removing");
            setTimeout(function () {
                el.remove();
            }, 250);
        };
        if (close) close.addEventListener("click", remove);
        setTimeout(remove, 3500);
    }

    function animateNumber(el, target) {
        if (!el) return;
        var current = parseInt(el.textContent, 10) || 0;
        if (current === target) {
            el.textContent = target;
            return;
        }
        var diff = target - current;
        var steps = 12;
        var step = 0;
        var timer = setInterval(function () {
            step++;
            el.textContent = Math.round(current + diff * (step / steps));
            if (step >= steps) {
                el.textContent = target;
                clearInterval(timer);
            }
        }, 25);
    }

    function clearScreenGuideHighlights() {
        if (!dom.screenGuideLayer) return;
        dom.screenGuideLayer.innerHTML = "";
    }

    function renderScreenGuideHighlights() {
        if (!dom.screenGuideLayer) return;
        clearScreenGuideHighlights();

        var occupiedTooltipRects = [];

        function overlapArea(a, b) {
            var x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            var y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return x * y;
        }

        function intersectsAny(rect) {
            for (var i = 0; i < occupiedTooltipRects.length; i++) {
                if (overlapArea(rect, occupiedTooltipRects[i]) > 0) return true;
            }
            return false;
        }

        function clampRect(rect, width, height) {
            var margin = 8;
            var left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
            var top = Math.max(margin, Math.min(rect.top, window.innerHeight - height - margin));
            return { left: left, top: top, right: left + width, bottom: top + height };
        }

        guideItems.forEach(function (item, idx) {
            var target = document.querySelector(item.selector);
            if (!target) return;

            var rect = target.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            var pad = 6;
            var box = document.createElement("div");
            box.className = "screen-guide-highlight";
            box.style.top = Math.max(rect.top - pad, 6) + "px";
            box.style.left = Math.max(rect.left - pad, 6) + "px";
            box.style.width = Math.min(rect.width + pad * 2, window.innerWidth - 12) + "px";
            box.style.height = rect.height + pad * 2 + "px";

            var badge = document.createElement("div");
            badge.className = "screen-guide-badge";
            badge.textContent = String(idx + 1);
            badge.style.top = Math.max(rect.top - 16, 4) + "px";
            badge.style.left = Math.max(rect.left - 4, 4) + "px";

            var tooltip = document.createElement("div");
            tooltip.className = "screen-guide-tooltip";
            tooltip.innerHTML = '<div class="screen-guide-tooltip-title">'
                + '<span class="guide-item-no">' + (idx + 1) + "</span>"
                + "<span>" + item.title + "</span></div>"
                + '<p class="screen-guide-tooltip-text">' + item.text + "</p>";
            tooltip.style.left = "-9999px";
            tooltip.style.top = "-9999px";
            dom.screenGuideLayer.appendChild(tooltip);

            var tooltipWidth = tooltip.offsetWidth || (window.innerWidth <= 768 ? 220 : 260);
            var tooltipHeight = tooltip.offsetHeight || 96;

            var candidates;
            if (idx === 1) {
                candidates = [
                    { left: rect.left - tooltipWidth - 10, top: rect.top },
                    { left: rect.left, top: rect.bottom + 10 },
                    { left: rect.left - tooltipWidth - 10, top: rect.bottom - tooltipHeight },
                    { left: rect.left, top: rect.top - tooltipHeight - 10 },
                    { left: rect.right + 10, top: rect.top }
                ];
            } else if (idx === 2) {
                candidates = [
                    { left: rect.right + 10, top: rect.top },
                    { left: rect.left, top: rect.top - tooltipHeight - 10 },
                    { left: rect.right + 10, top: rect.bottom - tooltipHeight },
                    { left: rect.left, top: rect.bottom + 10 },
                    { left: rect.left - tooltipWidth - 10, top: rect.top }
                ];
            } else if (idx === 4) {
                candidates = [
                    { left: rect.left, top: rect.top + 10 },
                    { left: rect.right + 10, top: rect.top },
                    { left: rect.left - tooltipWidth - 10, top: rect.top },
                    { left: rect.left, top: rect.top - tooltipHeight - 10 },
                    { left: rect.left, top: rect.bottom + 10 },
                    { left: rect.right + 10, top: rect.bottom - tooltipHeight }
                ];
            } else {
                candidates = [
                    { left: rect.right + 10, top: rect.top },
                    { left: rect.left - tooltipWidth - 10, top: rect.top },
                    { left: rect.right + 10, top: rect.bottom - tooltipHeight },
                    { left: rect.left - tooltipWidth - 10, top: rect.bottom - tooltipHeight },
                    { left: rect.left, top: rect.bottom + 10 },
                    { left: rect.left, top: rect.top - tooltipHeight - 10 }
                ];
            }

            var best = null;
            var bestScore = Number.MAX_SAFE_INTEGER;
            for (var c = 0; c < candidates.length; c++) {
                var candidateRect = clampRect({ left: candidates[c].left, top: candidates[c].top }, tooltipWidth, tooltipHeight);
                if (!intersectsAny(candidateRect)) {
                    best = candidateRect;
                    break;
                }

                var score = 0;
                for (var o = 0; o < occupiedTooltipRects.length; o++) {
                    score += overlapArea(candidateRect, occupiedTooltipRects[o]);
                }
                if (score < bestScore) {
                    bestScore = score;
                    best = candidateRect;
                }
            }

            var shiftStep = 14;
            var attempt = 0;
            while (best && intersectsAny(best) && attempt < 20) {
                var shifted = {
                    left: best.left,
                    top: best.top + shiftStep + attempt,
                    right: best.right,
                    bottom: best.bottom + shiftStep + attempt
                };
                best = clampRect(shifted, tooltipWidth, tooltipHeight);
                attempt += 1;
            }

            if (!best) {
                best = clampRect({ left: rect.right + 10, top: rect.top }, tooltipWidth, tooltipHeight);
            }

            tooltip.style.left = best.left + "px";
            tooltip.style.top = best.top + "px";
            occupiedTooltipRects.push(best);

            dom.screenGuideLayer.appendChild(box);
            dom.screenGuideLayer.appendChild(badge);
            dom.screenGuideLayer.appendChild(tooltip);
        });
    }

    function closeScreenGuide() {
        if (!dom.screenGuideOverlay) return;
        isScreenGuideOpen = false;
        dom.screenGuideOverlay.classList.remove("show");
        dom.screenGuideOverlay.setAttribute("aria-hidden", "true");
        clearScreenGuideHighlights();
    }

    function openScreenGuide() {
        if (!dom.screenGuideOverlay) return;
        renderScreenGuideHighlights();
        isScreenGuideOpen = true;
        dom.screenGuideOverlay.classList.add("show");
        dom.screenGuideOverlay.setAttribute("aria-hidden", "false");
    }

    function bindScreenGuide() {
        if (!dom.btnScreenGuide || !dom.screenGuideOverlay) return;

        dom.btnScreenGuide.addEventListener("click", openScreenGuide);
        if (dom.screenGuideClose) dom.screenGuideClose.addEventListener("click", closeScreenGuide);
        if (dom.screenGuideDim) dom.screenGuideDim.addEventListener("click", closeScreenGuide);

        window.addEventListener("resize", function () {
            if (isScreenGuideOpen) renderScreenGuideHighlights();
        });
        window.addEventListener("scroll", function () {
            if (isScreenGuideOpen) renderScreenGuideHighlights();
        }, true);
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && isScreenGuideOpen) closeScreenGuide();
        });
    }

    function safeCountListTotal() {
        try {
            if (typeof countList !== "undefined" && countList && countList[3] && countList[3].count != null) {
                var n = parseInt(countList[3].count, 10);
                return isNaN(n) ? 0 : n;
            }
        } catch (e) { }
        return null;
    }

    function computeStatsFromVisible() {
        var total = 0;
        var todayCount = 0;
        var active = 0;
        var inactive = 0;

        try {
            if (typeof countList !== "undefined" && countList) {
                total = countList[3] && countList[3].count ? countList[3].count : 0;
                todayCount = countList[1] && countList[1].count ? countList[1].count : 0;
                active = countList[2] && countList[2].count ? countList[2].count : 0;
                inactive = countList[0] && countList[0].count ? countList[0].count : 0;
            }
        } catch (e) { }

        animateNumber(dom.statTotal, parseInt(total, 10) || 0);
        animateNumber(dom.statToday, parseInt(todayCount, 10) || 0);
        animateNumber(dom.statActive, parseInt(active, 10) || 0);
        animateNumber(dom.statInactive, parseInt(inactive, 10) || 0);
    }

    function extractTotalFromHeaders(headers) {
        var keys = ["x-total-count", "x-total", "total-count", "total"];
        for (var i = 0; i < keys.length; i++) {
            var v = headers.get(keys[i]);
            if (v != null && String(v).trim() !== "") {
                var n = parseInt(v, 10);
                if (!isNaN(n) && n >= 0) return n;
            }
        }
        return null;
    }

    function extractTotalFromItems(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        var first = arr[0];
        if (!first || typeof first !== "object") return null;

        var candidates = ["totalCount", "total", "totalElements", "totalItemCount"];
        for (var i = 0; i < candidates.length; i++) {
            var k = candidates[i];
            if (first[k] != null) {
                var n = parseInt(first[k], 10);
                if (!isNaN(n) && n >= 0) return n;
            }
        }
        return null;
    }

    function extractTotalFromEnvelope(json) {
        if (!json || typeof json !== "object") return null;
        if (json.totalCount != null) {
            var n = parseInt(json.totalCount, 10);
            return isNaN(n) ? null : n;
        }
        if (json.total != null) {
            var n2 = parseInt(json.total, 10);
            return isNaN(n2) ? null : n2;
        }
        return null;
    }

    function extractItemsFromEnvelope(json) {
        if (!json || typeof json !== "object") return [];
        if (Array.isArray(json.items)) return json.items;
        if (Array.isArray(json.data)) return json.data;
        if (Array.isArray(json.list)) return json.list;
        return [];
    }

    function normalizePageData(arr) {
        if (!Array.isArray(arr)) return [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i]) arr[i].registDate = formatDateYYYYMMDD(arr[i].registDate);
        }
        return arr;
    }

    function sortDocuments(list) {
        var sorted = list.slice();
        var sf = normalizeSortField(sortField);

        sorted.sort(function (a, b) {
            var valA, valB;

            if (sf === "fileName") {
                valA = (a.fileName || "").toLowerCase();
                valB = (b.fileName || "").toLowerCase();
            } else {
                valA = formatDateYYYYMMDD(a.registDate || "");
                valB = formatDateYYYYMMDD(b.registDate || "");
            }

            var cmp = 0;
            if (valA < valB) cmp = -1;
            else if (valA > valB) cmp = 1;

            return sortOrder === "asc" ? cmp : -cmp;
        });

        return sorted;
    }

    function modeKey() {
        if (!isSearchMode) return "list|" + perPage + "|" + normalizeSortField(sortField) + "|" + sortOrder;
        return "search|" + (searchField || "") + "|" + (searchQuery || "") + "|" + perPage + "|" + normalizeSortField(sortField) + "|" + sortOrder;
    }

    function cacheBucket() {
        return isSearchMode ? cache.search : cache.list;
    }

    function getCachedPage(page) {
        var bucket = cacheBucket();
        var key = modeKey();
        if (!bucket[key]) bucket[key] = {};
        return bucket[key][page] || null;
    }

    function setCachedPage(page, data) {
        var bucket = cacheBucket();
        var key = modeKey();
        if (!bucket[key]) bucket[key] = {};
        bucket[key][page] = data;
    }

    function resetPaging() {
        paging.totalItems = null;
        paging.totalPages = null;
        paging.hasMore = true;
        paging.lastFetchCount = 0;
        paging.headersTotal = null;
        paging.maxKnownPage = 0;
        paging.endReachedAt = null;
    }

    function clearAllCaches() {
        cache.list = {};
        cache.search = {};
    }

    function closeStatusPopup() {
        if (activeStatusPopup) {
            activeStatusPopup.remove();
            activeStatusPopup = null;
        }
    }

    function renderTable() {
        closeStatusPopup();

        var pageData = documents.slice();
        pageData = sortDocuments(pageData);

        if (pageData.length === 0) {
            dom.tableBody.innerHTML =
                '<tr><td colspan="8">' +
                '<div class="empty-state">' +
                '<div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
                '<div class="empty-state-title">문서가 없습니다</div>' +
                '<div class="empty-state-desc">' +
                (searchQuery ? "검색 결과가 없습니다. 다른 키워드로 검색해보세요." : "새로운 문서를 추가해주세요.") +
                "</div>" +
                "</div></td></tr>";
        } else {
            var html = "";
            for (var i = 0; i < pageData.length; i++) {
                var doc = pageData[i];
                var rowNum = (currentPage - 1) * perPage + i + 1;
                var ext = getExtFromFileName(doc.fileName);
                var typeClass = getFileTypeClass(ext);
                var extLabel = ext ? ext.toUpperCase() : "-";
                var statusClass = doc.isUse ? "active" : "inactive";
                var statusLabel = doc.isUse ? "활성" : "비활성";
                var registDate = formatDateYYYYMMDD(doc.registDate);

                html +=
                    '<tr data-key="' +
                    escapeHtml(doc.key) +
                    '">' +
                    '<td class="center" style="color:var(--text-light);font-size:0.82rem;">' +
                    rowNum +
                    "</td>" +
                    "<td>" +
                    '<div class="file-name-cell">' +
                    '<div class="file-icon ' +
                    typeClass +
                    '">' +
                    escapeHtml(extLabel.substring(0, 4)) +
                    "</div>" +
                    '<div class="file-meta">' +
                    '<div class="file-title" title="' +
                    escapeHtml(doc.fileName) +
                    '">' +
                    escapeHtml(doc.fileName) +
                    "</div>" +
                    "</div></div></td>" +
                    '<td class="center" style="text-transform:uppercase;color:var(--text-mid);font-size:0.82rem;">' +
                    escapeHtml(ext || "-") +
                    "</td>" +
                    '<td class="center" style="color:var(--text-mid);font-size:0.82rem;">' +
                    formatBytes(doc.length) +
                    "</td>" +
                    '<td class="center">' +
                    escapeHtml(doc.adminName) +
                    "</td>" +
                    '<td class="center" style="font-size:0.82rem;color:var(--text-mid);font-variant-numeric:tabular-nums;">' +
                    escapeHtml(registDate) +
                    "</td>" +
                    '<td class="center"><div class="status-cell" style="position:relative;"><span class="badge ' +
                    statusClass +
                    ' badge-clickable" data-key="' +
                    escapeHtml(doc.key) +
                    '" data-current="' +
                    (doc.isUse ? "true" : "false") +
                    '">' +
                    statusLabel +
                    "</span></div></td>" +
                    '<td class="center">' +
                    '<div class="action-btns">' +
                    '<button class="btn-icon danger" title="삭제" data-delete-key="' +
                    escapeHtml(doc.key) +
                    '" data-delete-name="' +
                    escapeHtml(doc.fileName) +
                    '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                    "</button>" +
                    "</div></td></tr>";
            }
            dom.tableBody.innerHTML = html;
        }

        renderTableInfo();
        renderPagination();
        computeStatsFromVisible();
    }

    function renderTableInfo() {
        var start = (currentPage - 1) * perPage + 1;
        var end = (currentPage - 1) * perPage + documents.length;

        if (paging.totalItems != null && paging.totalItems >= 0) {
            if (paging.totalItems === 0) {
                dom.tableInfo.innerHTML = "총 <strong>0</strong>건";
            } else {
                dom.tableInfo.innerHTML =
                    "총 <strong>" +
                    paging.totalItems +
                    "</strong>건 중 <strong>" +
                    start +
                    "</strong>-<strong>" +
                    Math.min(end, paging.totalItems) +
                    "</strong>";
            }
            return;
        }

        if (documents.length === 0 && currentPage === 1) {
            dom.tableInfo.innerHTML = "총 <strong>0</strong>건";
            return;
        }

        dom.tableInfo.innerHTML = "<strong>" + start + "</strong>-<strong>" + end + "</strong>";
    }

    function clampBlockStart() {
        var bs = ui.blockSize;
        var cp = Math.max(1, parseInt(currentPage, 10) || 1);
        var blockIndex = Math.floor((cp - 1) / bs);
        ui.pageBlockStart = blockIndex * bs + 1;
        if (ui.pageBlockStart < 1) ui.pageBlockStart = 1;
    }

    function getBlockEnd() {
        return ui.pageBlockStart + ui.blockSize - 1;
    }

    function canBlockPrev() {
        return ui.pageBlockStart > 1;
    }

    function canBlockNext() {
        if (paging.totalPages != null) return ui.pageBlockStart + ui.blockSize <= paging.totalPages;
        return paging.hasMore === true;
    }

    function renderPagination() {
        clampBlockStart();

        var start = ui.pageBlockStart;
        var end = getBlockEnd();

        if (paging.totalPages != null) end = Math.min(end, paging.totalPages);
        if (end < start) end = start;

        var html = "";

        html +=
            '<button class="page-btn" data-block="prev"' +
            (canBlockPrev() ? "" : " disabled") +
            ' title="이전">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>';

        for (var p = start; p <= end; p++) {
            html +=
                '<button class="page-btn' +
                (p === currentPage ? " active" : "") +
                '" data-page="' +
                p +
                '">' +
                p +
                "</button>";
        }

        html +=
            '<button class="page-btn" data-block="next"' +
            (canBlockNext() ? "" : " disabled") +
            ' title="다음">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>';

        dom.pagination.innerHTML = html;
    }

    function postForm(url, formData) {
        return fetch(url, { method: "POST", body: formData });
    }

    // 문서 카운트를 비동기로 로딩해 요약 카드(전체/오늘/사용/미사용)를 갱신한다.
    // 실패해도 화면은 유지하고 카드만 미표시(0) 처리한다.
    function fetchCount() {
        var id = getAdminId();
        var formData = new FormData();
        formData.append("adminId", id);

        return postForm("/admin/storage/count", formData)
            .then(function (res) { return res.json(); })
            .then(function (arr) {
                window.countList = Array.isArray(arr) ? arr : [];
                computeStatsFromVisible();
            })
            .catch(function (err) {
                window.countList = [];
                computeStatsFromVisible();
            });
    }

    function applyPagingFromTotal(total, page) {
        paging.totalItems = total;
        paging.totalPages = Math.max(1, Math.ceil(total / perPage));
        paging.hasMore = page < paging.totalPages;
        paging.maxKnownPage = Math.max(paging.maxKnownPage, page);
        paging.endReachedAt = paging.totalPages;
    }

    function applyPagingUnknown(arr, page) {
        paging.totalItems = null;
        paging.totalPages = null;

        if (arr.length < perPage) {
            paging.hasMore = false;
            paging.endReachedAt = page;
        } else {
            paging.hasMore = true;
            paging.endReachedAt = null;
        }
        paging.maxKnownPage = Math.max(paging.maxKnownPage, page);
    }

    function applyPageResult(page, arr, headerTotal, bodyTotal) {
        documents = arr.slice();
        paging.lastFetchCount = arr.length;

        var total = null;

        if (headerTotal != null) total = headerTotal;
        if (total == null && bodyTotal != null) total = bodyTotal;
        if (total == null) total = extractTotalFromItems(arr);

        if (!isSearchMode && total == null) {
            var fallbackTotal = safeCountListTotal();
            if (fallbackTotal != null && fallbackTotal >= 0) total = fallbackTotal;
        }

        if (total != null) applyPagingFromTotal(total, page);
        else applyPagingUnknown(arr, page);

        currentPage = page;

        setCachedPage(page, {
            data: documents.slice(),
            totalItems: paging.totalItems,
            totalPages: paging.totalPages,
            hasMore: paging.hasMore,
            lastFetchCount: paging.lastFetchCount,
            endReachedAt: paging.endReachedAt
        });

        renderTable();
    }

    function fetchListPage(page) {
        isSearchMode = false;
        searchQuery = "";

        var cached = getCachedPage(page);
        if (cached) {
            documents = cached.data.slice();
            paging.totalItems = cached.totalItems;
            paging.totalPages = cached.totalPages;
            paging.hasMore = cached.hasMore;
            paging.lastFetchCount = cached.lastFetchCount;
            paging.endReachedAt = cached.endReachedAt;
            currentPage = page;
            renderTable();
            return Promise.resolve();
        }

        showLoading(true);

        var id = getAdminId();
        var formData = new FormData();
        formData.append("adminId", id);
        formData.append("size", perPage);
        formData.append("page", page);
        formData.append("orderType", getOrderType());
        formData.append("order", sortOrder);

        return postForm("/admin/storage/list", formData)
            .then(function (res) {
                var hTotal = extractTotalFromHeaders(res.headers);
                paging.headersTotal = hTotal;
                return res.json().then(function (json) {
                    var bodyTotal = extractTotalFromEnvelope(json);
                    var items = Array.isArray(json) ? json : extractItemsFromEnvelope(json);
                    return { items: items, headerTotal: hTotal, bodyTotal: bodyTotal };
                });
            })
            .then(function (pack) {
                var arr = normalizePageData(Array.isArray(pack.items) ? pack.items : []);
                applyPageResult(page, arr, pack.headerTotal, pack.bodyTotal);
                showLoading(false);
            })
            .catch(function (err) {
                console.error("fetchListPage error:", err);
                toast("문서 목록을 불러오는데 실패했습니다.", "error");
                showLoading(false);
            });
    }

    function fetchSearchPage(page) {
        var query = (dom.searchInput && dom.searchInput.value ? dom.searchInput.value : "").trim();
        if (!query) {
            isSearchMode = false;
            searchQuery = "";
            resetPaging();
            clearAllCaches();
            ui.pageBlockStart = 1;
            return fetchListPage(1);
        }

        isSearchMode = true;
        searchQuery = query;
        searchField = dom.searchField ? dom.searchField.value : searchField;

        var cached = getCachedPage(page);
        if (cached) {
            documents = cached.data.slice();
            paging.totalItems = cached.totalItems;
            paging.totalPages = cached.totalPages;
            paging.hasMore = cached.hasMore;
            paging.lastFetchCount = cached.lastFetchCount;
            paging.endReachedAt = cached.endReachedAt;
            currentPage = page;
            renderTable();
            return Promise.resolve();
        }

        showLoading(true);

        var id = getAdminId();
        var formData = new FormData();
        formData.append("adminId", id);
        formData.append("type", searchField);
        formData.append("context", query);
        formData.append("size", perPage);
        formData.append("page", page);
        formData.append("orderType", getOrderType());
        formData.append("order", sortOrder);

        return postForm("/admin/storage/search", formData)
            .then(function (res) {
                var hTotal = extractTotalFromHeaders(res.headers);
                paging.headersTotal = hTotal;
                return res.json().then(function (json) {
                    var bodyTotal = extractTotalFromEnvelope(json);
                    var items = Array.isArray(json) ? json : extractItemsFromEnvelope(json);
                    return { items: items, headerTotal: hTotal, bodyTotal: bodyTotal };
                });
            })
            .then(function (pack) {
                var arr = normalizePageData(Array.isArray(pack.items) ? pack.items : []);
                applyPageResult(page, arr, pack.headerTotal, pack.bodyTotal);
                showLoading(false);
            })
            .catch(function (err) {
                console.error("fetchSearchPage error:", err);
                toast("검색에 실패했습니다.", "error");
                showLoading(false);
            });
    }

    function updateSortUI() {
        if (!dom.sortIconSvg || !dom.sortLabel) return;

        if (sortOrder === "asc") {
            dom.sortIconSvg.innerHTML = '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>';
            dom.sortLabel.textContent = "오름차순";
        } else {
            dom.sortIconSvg.innerHTML = '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>';
            dom.sortLabel.textContent = "내림차순";
        }
    }

    function refreshCurrentModeFromFirstPage() {
        resetPaging();
        clearAllCaches();
        currentPage = 1;
        ui.pageBlockStart = 1;
        syncSortSelectUI();
        updateSortUI();
        if (isSearchMode) return fetchSearchPage(1);
        return fetchListPage(1);
    }

    function goToPage(page) {
        page = parseInt(page, 10);
        if (isNaN(page) || page < 1) return Promise.resolve();

        currentPage = page;

        if (isSearchMode) return fetchSearchPage(page);
        return fetchListPage(page);
    }

    function goBlock(direction) {
        var bs = ui.blockSize;
        clampBlockStart();

        if (direction === "prev") {
            if (!canBlockPrev()) return;
            var prevStart = Math.max(1, ui.pageBlockStart - bs);
            ui.pageBlockStart = prevStart;
            goToPage(prevStart);
            return;
        }

        if (direction === "next") {
            if (!canBlockNext()) return;
            var nextStart = ui.pageBlockStart + bs;

            if (paging.totalPages != null && nextStart > paging.totalPages) return;

            ui.pageBlockStart = nextStart;
            goToPage(nextStart);
        }
    }

    function openDocModal() {
        dom.docModalTitle.textContent = "문서 추가";
        dom.docUploader.value = getAdminId();
        pendingFiles = [];
        dom.fileInput.value = "";
        dom.filePreviewWrap.innerHTML = "";
        dom.docModal.classList.add("show");
    }

    function closeDocModal() {
        dom.docModal.classList.remove("show");
        pendingFiles = [];
        if (dom.fileInput) dom.fileInput.value = "";
        if (dom.filePreviewWrap) dom.filePreviewWrap.innerHTML = "";
    }

    function openConfirm(title, msg, cb) {
        dom.confirmTitle.textContent = title;
        dom.confirmMsg.textContent = msg;
        confirmCallback = cb;
        dom.confirmModal.classList.add("show");
    }

    function closeConfirm() {
        dom.confirmModal.classList.remove("show");
        confirmCallback = null;
    }

    function renderPendingFiles() {
        if (!dom.filePreviewWrap) return;
        if (!pendingFiles.length) {
            dom.filePreviewWrap.innerHTML = "";
            return;
        }

        var html = "";
        for (var i = 0; i < pendingFiles.length; i++) {
            var file = pendingFiles[i];
            html +=
                '<div class="file-preview">' +
                '<span class="file-preview-name">' +
                escapeHtml(file.name) +
                "</span>" +
                '<span class="file-preview-size">' +
                formatBytes(file.size) +
                "</span>" +
                '<button class="file-preview-remove" type="button" data-remove-index="' + i + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                "</button></div>";
        }
        dom.filePreviewWrap.innerHTML = html;
    }

    function fileKey(file) {
        return [file.name || "", file.size || 0, file.lastModified || 0].join("|");
    }

    function handleFileSelect(files, append) {
        if (!files || !files.length) return;

        var next = append ? pendingFiles.slice() : [];
        var seen = {};
        for (var i = 0; i < next.length; i++) seen[fileKey(next[i])] = true;

        for (var j = 0; j < files.length; j++) {
            var f = files[j];
            if (!f) continue;
            var key = fileKey(f);
            if (seen[key]) continue;
            seen[key] = true;
            next.push(f);
        }

        pendingFiles = next;
        renderPendingFiles();
    }

    function showStatusPopup(badgeEl, key, currentIsUse) {
        closeStatusPopup();
        var popup = document.createElement("div");
        popup.className = "status-popup";

        var isActive = currentIsUse === "true" || currentIsUse === true;

        popup.innerHTML =
            '<div class="status-popup-title">상태 변경</div>' +
            '<button class="status-popup-btn' +
            (isActive ? " current" : "") +
            '" data-value="true">' +
            '<span class="badge active" style="pointer-events:none;">활성</span>' +
            (isActive
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"/></svg>'
                : "") +
            "</button>" +
            '<button class="status-popup-btn' +
            (!isActive ? " current" : "") +
            '" data-value="false">' +
            '<span class="badge inactive" style="pointer-events:none;">비활성</span>' +
            (!isActive
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"/></svg>'
                : "") +
            "</button>";

        var cell = badgeEl.closest(".status-cell");
        cell.appendChild(popup);
        activeStatusPopup = popup;

        requestAnimationFrame(function () {
            popup.classList.add("show");
        });

        popup.addEventListener("click", function (e) {
            var btn = e.target.closest(".status-popup-btn");
            if (!btn) return;
            var newVal = btn.getAttribute("data-value") === "true";
            if (newVal === isActive) {
                closeStatusPopup();
                return;
            }
            toggleUsage(key, newVal);
        });
    }

    function toggleUsage(key, newIsUse) {
        showLoading(true);
        var id = getAdminId();
        var formData = new FormData();
        formData.append("adminId", id);
        formData.append("key", key);
        formData.append("isUse", newIsUse);

        fetch("/admin/storage/usage", { method: "POST", body: formData })
            .then(function (res) {
                return res.text();
            })
            .then(function (data) {
                closeStatusPopup();
                if (String(data || "").trim() === "ok") {
                    toast("상태가 변경되었습니다.", "success");
                    clearAllCaches();
                    resetPaging();
                    if (isSearchMode) fetchSearchPage(currentPage);
                    else fetchListPage(currentPage);
                } else {
                    toast("상태 변경에 실패했습니다.", "error");
                    showLoading(false);
                }
            })
            .catch(function (err) {
                closeStatusPopup();
                console.error("toggleUsage error:", err);
                toast("상태 변경 중 오류가 발생했습니다.", "error");
                showLoading(false);
            });
    }

    function deleteFile(key, fileName) {
        openConfirm("문서를 삭제하시겠습니까?", '"' + fileName + '" 문서를 삭제하면 복구할 수 없습니다.', function () {
            showLoading(true);
            var id = getAdminId();
            var formData = new FormData();
            formData.append("adminId", id);
            formData.append("key", key);

            fetch("/admin/storage/delete", { method: "POST", body: formData })
                .then(function (res) {
                    return res.text();
                })
                .then(function (data) {
                    closeConfirm();
                    if (String(data || "").trim() === "ok") {
                        toast("문서가 삭제되었습니다.", "success");
                        resetPaging();
                        clearAllCaches();
                        ui.pageBlockStart = 1;
                        currentPage = 1;
                        if (isSearchMode) fetchSearchPage(1);
                        else fetchListPage(1);
                    } else {
                        toast("문서 삭제에 실패했습니다.", "error");
                        showLoading(false);
                    }
                })
                .catch(function (err) {
                    closeConfirm();
                    console.error("deleteFile error:", err);
                    toast("문서 삭제 중 오류가 발생했습니다.", "error");
                    showLoading(false);
                });
        });
    }

    function uploadFile() {
        if (!pendingFiles.length) {
            toast("파일을 선택해주세요.", "error");
            return;
        }

        showLoading(true);
        dom.docModalSave.disabled = true;

        var id = getAdminId();
        var files = pendingFiles.slice();
        var successCount = 0;
        var failCount = 0;
        var chain = Promise.resolve();

        files.forEach(function (file) {
            chain = chain.then(function () {
                var formData = new FormData();
                formData.append("adminId", id);
                formData.append("file", file);

                return fetch("/admin/storage/add", { method: "POST", body: formData })
                    .then(function (res) { return res.text(); })
                    .then(function (data) {
                        if (String(data || "").trim() === "ok") successCount++;
                        else failCount++;
                    })
                    .catch(function () {
                        failCount++;
                    });
            });
        });

        chain.then(function () {
            dom.docModalSave.disabled = false;

            if (failCount === 0) {
                toast(successCount + "개 문서가 추가되었습니다.", "success");
            } else if (successCount === 0) {
                toast("문서 추가에 실패했습니다.", "error");
                showLoading(false);
                return;
            } else {
                toast("일부 문서만 추가되었습니다. 성공 " + successCount + "건, 실패 " + failCount + "건", "error");
            }

            closeDocModal();
            resetPaging();
            clearAllCaches();
            ui.pageBlockStart = 1;
            currentPage = 1;
            if (isSearchMode) fetchSearchPage(1);
            else fetchListPage(1);
        });
    }

    function bindEvents() {
        if (dom.btnSidebarToggle) {
            dom.btnSidebarToggle.addEventListener("click", function () {
                if (dom.sidebar) dom.sidebar.classList.toggle("open");
                if (dom.sidebarOverlay) dom.sidebarOverlay.classList.toggle("show");
            });
        }

        if (dom.sidebarOverlay) {
            dom.sidebarOverlay.addEventListener("click", function () {
                if (dom.sidebar) dom.sidebar.classList.remove("open");
                dom.sidebarOverlay.classList.remove("show");
            });
        }

        if (dom.btnLogout) {
            dom.btnLogout.addEventListener("click", function () {
                sessionStorage.removeItem("userId");
                sessionStorage.removeItem("adminId");
                window.location.href = "/admin";
            });
        }

        if (dom.btnSearch) {
            dom.btnSearch.addEventListener("click", function () {
                currentPage = 1;
                ui.pageBlockStart = 1;
                isSearchMode = true;
                searchQuery = dom.searchInput.value.trim();
                searchField = dom.searchField.value;
                resetPaging();
                clearAllCaches();
                fetchSearchPage(1);
            });
        }

        if (dom.searchInput) {
            dom.searchInput.addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    currentPage = 1;
                    ui.pageBlockStart = 1;
                    isSearchMode = true;
                    searchQuery = dom.searchInput.value.trim();
                    searchField = dom.searchField.value;
                    resetPaging();
                    clearAllCaches();
                    fetchSearchPage(1);
                }
            });

            dom.searchInput.addEventListener("input", function () {
                if (dom.searchInput.value.trim() === "" && isSearchMode) {
                    isSearchMode = false;
                    searchQuery = "";
                    currentPage = 1;
                    ui.pageBlockStart = 1;
                    resetPaging();
                    clearAllCaches();
                    fetchListPage(1);
                }
            });
        }

        if (dom.sortField) {
            dom.sortField.addEventListener("change", function () {
                sortField = normalizeSortField(dom.sortField.value);
                refreshCurrentModeFromFirstPage();
            });
        }

        if (dom.btnSort) {
            dom.btnSort.addEventListener("click", function () {
                sortOrder = sortOrder === "desc" ? "asc" : "desc";
                refreshCurrentModeFromFirstPage();
            });
        }

        if (dom.perPageSelect) {
            dom.perPageSelect.addEventListener("change", function () {
                perPage = parseInt(dom.perPageSelect.value, 10);
                if (isNaN(perPage) || perPage < 1) perPage = 10;
                refreshCurrentModeFromFirstPage();
            });
        }

        if (dom.pagination) {
            dom.pagination.addEventListener("click", function (e) {
                var blockBtn = e.target.closest("[data-block]");
                if (blockBtn) {
                    if (blockBtn.disabled) return;
                    var dir = blockBtn.getAttribute("data-block");
                    goBlock(dir);
                    return;
                }

                var btn = e.target.closest("[data-page]");
                if (!btn || btn.disabled || btn.classList.contains("active")) return;

                var page = parseInt(btn.getAttribute("data-page"), 10);
                if (isNaN(page) || page < 1) return;

                goToPage(page);
            });
        }

        if (dom.tableBody) {
            dom.tableBody.addEventListener("click", function (e) {
                var deleteBtn = e.target.closest("[data-delete-key]");
                if (deleteBtn) {
                    var key = deleteBtn.getAttribute("data-delete-key");
                    var name = deleteBtn.getAttribute("data-delete-name");
                    deleteFile(key, name);
                    return;
                }

                var badge = e.target.closest(".badge-clickable");
                if (badge) {
                    var bKey = badge.getAttribute("data-key");
                    var bCurrent = badge.getAttribute("data-current");
                    showStatusPopup(badge, bKey, bCurrent);
                    return;
                }
            });
        }

        document.addEventListener("click", function (e) {
            if (activeStatusPopup && !e.target.closest(".status-popup") && !e.target.closest(".badge-clickable")) {
                closeStatusPopup();
            }
        });

        if (dom.btnAddDoc) dom.btnAddDoc.addEventListener("click", openDocModal);
        if (dom.docModalClose) dom.docModalClose.addEventListener("click", closeDocModal);
        if (dom.docModalCancel) dom.docModalCancel.addEventListener("click", closeDocModal);

        if (dom.docModal) {
            dom.docModal.addEventListener("click", function (e) {
                if (e.target === dom.docModal) closeDocModal();
            });
        }

        if (dom.docModalSave) dom.docModalSave.addEventListener("click", uploadFile);

        if (dom.confirmCancel) dom.confirmCancel.addEventListener("click", closeConfirm);

        if (dom.confirmModal) {
            dom.confirmModal.addEventListener("click", function (e) {
                if (e.target === dom.confirmModal) closeConfirm();
            });
        }

        if (dom.confirmOk) {
            dom.confirmOk.addEventListener("click", function () {
                if (confirmCallback) confirmCallback();
            });
        }

        if (dom.fileInput) {
            dom.fileInput.addEventListener("change", function (e) {
                handleFileSelect(e.target.files, false);
            });
        }

        if (dom.filePreviewWrap) {
            dom.filePreviewWrap.addEventListener("click", function (e) {
                var removeBtn = e.target.closest("[data-remove-index]");
                if (!removeBtn) return;
                var idx = parseInt(removeBtn.getAttribute("data-remove-index"), 10);
                if (isNaN(idx) || idx < 0 || idx >= pendingFiles.length) return;
                pendingFiles.splice(idx, 1);
                renderPendingFiles();
            });
        }

        if (dom.fileUploadArea) {
            dom.fileUploadArea.addEventListener("dragover", function (e) {
                e.preventDefault();
                dom.fileUploadArea.classList.add("dragover");
            });
            dom.fileUploadArea.addEventListener("dragleave", function () {
                dom.fileUploadArea.classList.remove("dragover");
            });
            dom.fileUploadArea.addEventListener("drop", function (e) {
                e.preventDefault();
                dom.fileUploadArea.classList.remove("dragover");
                if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files, true);
            });
        }

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                if (activeStatusPopup) {
                    closeStatusPopup();
                    return;
                }
                if (dom.confirmModal && dom.confirmModal.classList.contains("show")) {
                    closeConfirm();
                    return;
                }
                if (dom.docModal && dom.docModal.classList.contains("show")) {
                    closeDocModal();
                    return;
                }
            }
        });

        var refreshBtn = document.getElementById("btnRefresh");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", function () {
                refreshCurrentModeFromFirstPage();
            });
        }

        bindScreenGuide();
    }

    function initDefaultSortOnLoad() {
        sortField = "registDate";
        sortOrder = "desc";
        syncSortSelectUI();
        updateSortUI();
    }

    function init() {
        if (typeof window.checkSession === "function") {
            if (!window.checkSession()) return;
        } else {
            var sid = getAdminId();
            if (!sid) {
                window.location.href = "/admin";
                return;
            }
        }

        getAdminId();

        initDefaultSortOnLoad();
        bindEvents();

        currentPage = 1;
        ui.pageBlockStart = 1;

        resetPaging();
        clearAllCaches();

        fetchListPage(1);
        fetchCount();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
