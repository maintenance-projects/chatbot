(function () {
    "use strict";

    /* ───── 상태 ───── */
    let dailyChart = null;
    let hourlyChart = null;
    let adminId = "";
    let searchUserId = "";
    let selectedTypes = []; // 선택된 타입 목록 (빈 배열이면 전체)

    /* ───── 타입 정의 ───── */
    var TYPES = ["CHAT", "DOCUMENT", "TEMPLATE", "DIALOG", "AUDIO"];
    var TYPE_LABELS = {
        CHAT:     "대화",
        DOCUMENT: "문서",
        TEMPLATE: "양식",
        DIALOG:   "채팅요약",
        AUDIO:    "통화요약"
    };
    var TYPE_COLORS = {
        CHAT:     { border: "#30364F", bg: "rgba(48,54,79,0.1)",  bar: "rgba(48,54,79,0.7)",  dot: "#30364F" },
        DOCUMENT: { border: "#27ae60", bg: "rgba(39,174,96,0.1)", bar: "rgba(39,174,96,0.7)", dot: "#27ae60" },
        TEMPLATE: { border: "#2980b9", bg: "rgba(41,128,185,0.1)",bar: "rgba(41,128,185,0.7)",dot: "#2980b9" },
        DIALOG:   { border: "#8e44ad", bg: "rgba(142,68,173,0.1)",bar: "rgba(142,68,173,0.7)",dot: "#8e44ad" },
        AUDIO:    { border: "#d35400", bg: "rgba(211,84,0,0.1)",  bar: "rgba(211,84,0,0.7)",  dot: "#d35400" }
    };

    /* ───── DOM ───── */
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    var elStartDate = $("#startDate");
    var elEndDate = $("#endDate");
    var elBtnApply = $("#btnApplyDate");
    var elRankingBody = $("#rankingTableBody");
    var elUserInput = $("#userSearchInput");
    var elBtnUserSearch = $("#btnUserSearch");
    var elBtnUserClear = $("#btnUserClear");
    var elUserBadge = $("#userFilterBadge");
    var elUserBadgeText = $("#userFilterText");
    var elUserBadgeRemove = $("#userFilterRemove");
    var elTypeSummary = $("#typeSummary");
    var elBtnScreenGuide = $("#btnScreenGuide");
    var elScreenGuideOverlay = $("#screenGuideOverlay");
    var elScreenGuideDim = $("#screenGuideDim");
    var elScreenGuideClose = $("#btnCloseScreenGuide");
    var elScreenGuideLayer = $("#screenGuideHighlightLayer");

    var guideItems = [
        { selector: "#btnApplyDate", title: "조회 버튼", text: "기간 조건을 기준으로 요약/차트/랭킹을 갱신합니다." },
        { selector: "#btnExport", title: "엑셀 다운로드", text: "현재 필터 조건으로 통계 엑셀 파일을 내려받습니다." },
        { selector: ".filter-user", title: "사용자 검색", text: "특정 사용자 ID로 결과를 좁혀서 분석할 수 있습니다." },
        { selector: ".stats-row-2", title: "요약 카드", text: "총 요청 수와 고유 사용자 수를 빠르게 확인합니다." },
        { selector: ".chart-grid", title: "차트 영역", text: "일별 추이와 시간대별 분포를 시각적으로 비교합니다." },
        { selector: "#hourlyDateSelect", title: "시간대별 날짜 선택", text: "특정 날짜를 선택하여 해당일의 시간대별 분포를 확인합니다." },
        { selector: ".table-card", title: "사용자 랭킹", text: "요청량 상위 사용자를 유형별 합계와 함께 확인합니다." }
    ];
    var isScreenGuideOpen = false;

    /* ───── 유틸 ───── */
    function formatDate(d) {
        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, "0");
        var dd = String(d.getDate()).padStart(2, "0");
        return yyyy + "-" + mm + "-" + dd;
    }

    function setDateRange(days) {
        var end = new Date();
        var start = new Date();
        if (days > 0) start.setDate(end.getDate() - (days - 1));
        elStartDate.value = formatDate(start);
        elEndDate.value = formatDate(end);
    }

    function animateNumber(el, target) {
        var duration = 500;
        var startVal = parseInt(el.textContent.replace(/,/g, "")) || 0;
        var diff = target - startVal;
        if (diff === 0) { el.textContent = target.toLocaleString(); return; }
        var startTime = performance.now();
        function tick(now) {
            var elapsed = now - startTime;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(startVal + diff * eased).toLocaleString();
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function showToast(msg, type) {
        var container = $("#toastContainer");
        var toast = document.createElement("div");
        toast.className = "toast " + (type || "");
        toast.innerHTML = '<span class="toast-text">' + msg + "</span>";
        container.appendChild(toast);
        setTimeout(function () {
            toast.classList.add("removing");
            toast.addEventListener("animationend", function () { toast.remove(); });
        }, 3000);
    }

    function clearScreenGuideHighlights() {
        if (!elScreenGuideLayer) return;
        elScreenGuideLayer.innerHTML = "";
    }

    function renderScreenGuideHighlights() {
        if (!elScreenGuideLayer) return;
        clearScreenGuideHighlights();
        var occupiedTooltipRects = [];

        function overlapArea(a, b) {
            var x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            var y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return x * y;
        }

        function intersectsAny(rect) {
            for (var i = 0; i < occupiedTooltipRects.length; i++) {
                if (overlapArea(rect, occupiedTooltipRects[i]) > 0) {
                    return true;
                }
            }
            return false;
        }

        function clampRect(rect, width, height) {
            var margin = 8;
            var left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
            var top = Math.max(margin, Math.min(rect.top, window.innerHeight - height - margin));
            return {
                left: left,
                top: top,
                right: left + width,
                bottom: top + height
            };
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
            elScreenGuideLayer.appendChild(tooltip);

            var tooltipWidth = tooltip.offsetWidth || (window.innerWidth <= 768 ? 220 : 260);
            var tooltipHeight = tooltip.offsetHeight || 96;

            var candidates;
            if (idx === 0) {
                candidates = [
                    { left: rect.left - tooltipWidth - 10, top: rect.top },
                    { left: rect.left, top: rect.top - tooltipHeight - 10 },
                    { left: rect.left - tooltipWidth - 10, top: rect.bottom - tooltipHeight },
                    { left: rect.left, top: rect.bottom + 10 },
                    { left: rect.right + 10, top: rect.top }
                ];
            } else if (idx === 1) {
                candidates = [
                    { left: rect.right + 10, top: rect.top },
                    { left: rect.left, top: rect.bottom + 10 },
                    { left: rect.right + 10, top: rect.bottom - tooltipHeight },
                    { left: rect.left, top: rect.top - tooltipHeight - 10 },
                    { left: rect.left - tooltipWidth - 10, top: rect.top }
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
                    { left: rect.left - tooltipWidth - 10, top: rect.top },
                    { left: rect.left - tooltipWidth - 10, top: rect.bottom - tooltipHeight },
                    { left: rect.left, top: rect.bottom + 10 },
                    { left: rect.left, top: rect.top - tooltipHeight - 10 },
                    { left: rect.right + 10, top: rect.top },
                    { left: rect.right + 10, top: rect.bottom - tooltipHeight }
                ];
            } else if (idx === 5) {
                candidates = [
                    { left: rect.right + 10, top: rect.top },
                    { left: rect.left, top: rect.top - tooltipHeight - 10 },
                    { left: rect.right + 10, top: rect.bottom - tooltipHeight },
                    { left: rect.left, top: rect.bottom + 10 },
                    { left: rect.left - tooltipWidth - 10, top: rect.top }
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
                var candidateRect = clampRect({
                    left: candidates[c].left,
                    top: candidates[c].top
                }, tooltipWidth, tooltipHeight);

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

            elScreenGuideLayer.appendChild(box);
            elScreenGuideLayer.appendChild(badge);
            elScreenGuideLayer.appendChild(tooltip);
        });
    }

    function closeScreenGuide() {
        if (!elScreenGuideOverlay) return;
        isScreenGuideOpen = false;
        elScreenGuideOverlay.classList.remove("show");
        elScreenGuideOverlay.setAttribute("aria-hidden", "true");
        clearScreenGuideHighlights();
    }

    function openScreenGuide() {
        if (!elScreenGuideOverlay) return;
        renderScreenGuideHighlights();
        isScreenGuideOpen = true;
        elScreenGuideOverlay.classList.add("show");
        elScreenGuideOverlay.setAttribute("aria-hidden", "false");
    }

    function bindScreenGuide() {
        if (!elBtnScreenGuide || !elScreenGuideOverlay) return;

        elBtnScreenGuide.addEventListener("click", openScreenGuide);
        if (elScreenGuideClose) {
            elScreenGuideClose.addEventListener("click", closeScreenGuide);
        }
        if (elScreenGuideDim) {
            elScreenGuideDim.addEventListener("click", closeScreenGuide);
        }

        window.addEventListener("resize", function () {
            if (isScreenGuideOpen) renderScreenGuideHighlights();
        });
        window.addEventListener("scroll", function () {
            if (isScreenGuideOpen) renderScreenGuideHighlights();
        }, true);
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && isScreenGuideOpen) {
                closeScreenGuide();
            }
        });
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    /* ───── 사용자 필터 ───── */
    function applyUserFilter() {
        var val = elUserInput.value.trim();
        if (!val) { clearUserFilter(); return; }
        searchUserId = val;
        elUserBadge.style.display = "";
        elUserBadgeText.textContent = "사용자: " + val;
        elBtnUserClear.style.display = "";
        loadAll();
    }

    function clearUserFilter() {
        searchUserId = "";
        elUserInput.value = "";
        elUserBadge.style.display = "none";
        elBtnUserClear.style.display = "none";
        loadAll();
    }

    /* ───── API 호출 ───── */
    function postData(url, params) {
        var fd = new FormData();
        fd.append("adminId", adminId);
        fd.append("startDate", elStartDate.value);
        fd.append("endDate", elEndDate.value);
        if (searchUserId) fd.append("userId", searchUserId);
        if (params) {
            Object.keys(params).forEach(function (k) { fd.append(k, params[k]); });
        }
        return fetch(url, { method: "POST", body: fd })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            });
    }

    /* ───── 요약 카드 + 타입 칩 갱신 ───── */
    function loadSummary() {
        postData("/admin/statistics/summary").then(function (data) {
            animateNumber($("#statTotal"), data.totalCount || 0);
            animateNumber($("#statUsers"), data.userCount || 0);

            // 타입별 칩 렌더링
            var tc = data.typeCounts || {};
            var html = "";

            // 전체 칩 추가
            var isAllActive = selectedTypes.length === 0;
            html += '<div class="type-chip type-chip-all' + (isAllActive ? ' active' : '') + '" data-type="ALL">'
                + '<span class="type-chip-label">전체</span>'
                + '</div>';

            TYPES.forEach(function (t) {
                var count = tc[t] || 0;
                var color = TYPE_COLORS[t] ? TYPE_COLORS[t].dot : "#999";
                var isActive = selectedTypes.length === 0 || selectedTypes.indexOf(t) !== -1;
                html += '<div class="type-chip' + (isActive ? ' active' : '') + '" data-type="' + t + '">'
                    + '<span class="type-dot" style="background:' + color + ';"></span>'
                    + '<span class="type-chip-label">' + TYPE_LABELS[t] + '</span>'
                    + '<span class="type-chip-value">' + count.toLocaleString() + '</span>'
                    + '</div>';
            });
            elTypeSummary.innerHTML = html;
            bindTypeChipEvents();
        }).catch(function () { showToast("요약 데이터를 불러올 수 없습니다.", "error"); });
    }

    function bindTypeChipEvents() {
        var chips = elTypeSummary.querySelectorAll(".type-chip");
        chips.forEach(function (chip) {
            chip.addEventListener("click", function () {
                var type = chip.getAttribute("data-type");
                handleTypeToggle(type);
            });
        });
    }

    function handleTypeToggle(type) {
        if (type === "ALL") {
            selectedTypes = [];
        } else {
            var idx = selectedTypes.indexOf(type);
            if (idx === -1) {
                selectedTypes.push(type);
            } else {
                selectedTypes.splice(idx, 1);
            }
        }

        // 칩 스타일 업데이트
        var chips = elTypeSummary.querySelectorAll(".type-chip");
        chips.forEach(function (chip) {
            var chipType = chip.getAttribute("data-type");
            if (chipType === "ALL") {
                chip.classList.toggle("active", selectedTypes.length === 0);
            } else {
                chip.classList.toggle("active", selectedTypes.length === 0 || selectedTypes.indexOf(chipType) !== -1);
            }
        });

        // 차트 업데이트
        loadDailyChart();
        renderHourlyChart();
    }

    /* ───── 일별 차트 ───── */
    function loadDailyChart() {
        postData("/admin/statistics/daily").then(function (rows) {
            var dateMap = {};
            rows.forEach(function (r) {
                if (!dateMap[r.date]) {
                    dateMap[r.date] = {};
                    TYPES.forEach(function (t) { dateMap[r.date][t] = 0; });
                }
                if (dateMap[r.date][r.type] !== undefined) {
                    dateMap[r.date][r.type] = r.totalCount;
                }
            });

            var labels = Object.keys(dateMap).sort();
            var displayLabels = labels.map(function (d) { return d.substring(5); });

            var datasets = [];
            var typesToShow = selectedTypes.length === 0 ? TYPES : selectedTypes;
            typesToShow.forEach(function (t) {
                var data = labels.map(function (d) { return dateMap[d][t]; });
                var hasData = data.some(function (v) { return v > 0; });
                if (hasData) {
                    var c = TYPE_COLORS[t];
                    datasets.push({
                        label: TYPE_LABELS[t],
                        data: data,
                        borderColor: c.border,
                        backgroundColor: c.bg,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    });
                }
            });

            if (dailyChart) dailyChart.destroy();
            dailyChart = new Chart($("#dailyChart"), {
                type: "line",
                data: { labels: displayLabels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "index", intersect: false },
                    plugins: {
                        legend: { position: "top", labels: { usePointStyle: true, padding: 16 } }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        }).catch(function () { showToast("일별 통계를 불러올 수 없습니다.", "error"); });
    }

    /* ───── 시간대별 차트 ───── */
    var hourlyRawData = [];
    var elHourlyDateSelect = $("#hourlyDateSelect");

    function loadHourlyChart() {
        postData("/admin/statistics/hourly").then(function (rows) {
            hourlyRawData = rows;

            // 날짜 목록 추출
            var dates = [];
            rows.forEach(function (r) {
                if (dates.indexOf(r.date) === -1) dates.push(r.date);
            });
            dates.sort();

            // select 옵션 구성
            var html = "";
            dates.forEach(function (d) {
                html += '<option value="' + d + '">' + d + '</option>';
            });
            elHourlyDateSelect.innerHTML = html;

            // 마지막 날짜 선택 후 렌더링
            if (dates.length > 0) {
                elHourlyDateSelect.value = dates[dates.length - 1];
            }
            renderHourlyChart();
        }).catch(function () { showToast("시간대별 통계를 불러올 수 없습니다.", "error"); });
    }

    function renderHourlyChart() {
        var selectedDate = elHourlyDateSelect.value;
        var hourData = {};
        TYPES.forEach(function (t) { hourData[t] = new Array(24).fill(0); });

        hourlyRawData.forEach(function (r) {
            if (r.date === selectedDate && hourData[r.type]) {
                hourData[r.type][r.hour] = r.totalCount;
            }
        });

        var labels = Array.from({ length: 24 }, function (_, i) { return i + "시"; });

        var datasets = [];
        var typesToShow = selectedTypes.length === 0 ? TYPES : selectedTypes;
        typesToShow.forEach(function (t) {
            var hasData = hourData[t].some(function (v) { return v > 0; });
            if (hasData) {
                var c = TYPE_COLORS[t];
                datasets.push({
                    label: TYPE_LABELS[t],
                    data: hourData[t],
                    backgroundColor: c.bar,
                    borderRadius: 3
                });
            }
        });

        if (hourlyChart) hourlyChart.destroy();
        hourlyChart = new Chart($("#hourlyChart"), {
            type: "bar",
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { position: "top", labels: { usePointStyle: true, padding: 16 } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 }, stacked: true },
                    x: { stacked: true }
                }
            }
        });
    }

    /* ───── 사용자 랭킹 ───── */
    function loadRanking() {
        postData("/admin/statistics/ranking").then(function (rows) {
            var userMap = {};
            rows.forEach(function (r) {
                if (!userMap[r.userId]) {
                    userMap[r.userId] = {};
                    TYPES.forEach(function (t) { userMap[r.userId][t] = 0; });
                }
                if (userMap[r.userId][r.type] !== undefined) {
                    userMap[r.userId][r.type] = r.totalCount;
                }
            });

            var sorted = Object.entries(userMap)
                .map(function (entry) {
                    var uid = entry[0], v = entry[1];
                    var total = 0;
                    TYPES.forEach(function (t) { total += v[t]; });
                    return { userId: uid, types: v, total: total };
                })
                .sort(function (a, b) { return b.total - a.total; })
                .slice(0, 5);

            if (sorted.length === 0) {
                elRankingBody.innerHTML =
                    '<tr><td colspan="8" class="center" style="padding:40px;color:var(--text-light);">데이터가 없습니다.</td></tr>';
                return;
            }

            var html = "";
            sorted.forEach(function (u, i) {
                var rank = i + 1;
                var badgeClass = "";
                if (rank === 1) badgeClass = "gold";
                else if (rank === 2) badgeClass = "silver";
                else if (rank === 3) badgeClass = "bronze";

                var rankHtml = badgeClass
                    ? '<span class="rank-badge ' + badgeClass + '">' + rank + "</span>"
                    : rank;

                html += "<tr>"
                    + "<td>" + rankHtml + "</td>"
                    + "<td>" + escapeHtml(u.userId) + "</td>";
                TYPES.forEach(function (t) {
                    html += "<td>" + (u.types[t] || 0).toLocaleString() + "</td>";
                });
                html += "<td><strong>" + u.total.toLocaleString() + "</strong></td>"
                    + "</tr>";
            });
            elRankingBody.innerHTML = html;
        }).catch(function () { showToast("사용자 랭킹을 불러올 수 없습니다.", "error"); });
    }

    /* ───── 전체 갱신 ───── */
    function loadAll() {
        loadSummary();
        loadDailyChart();
        loadHourlyChart();
        loadRanking();
    }

    /* ───── 이벤트 바인딩 ───── */
    function bindEvents() {
        // 프리셋 버튼
        $$(".filter-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                $$(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
                this.classList.add("active");
                setDateRange(parseInt(this.dataset.range));
                loadAll();
            });
        });

        // 날짜 직접 조회
        elBtnApply.addEventListener("click", function () {
            if (!elStartDate.value || !elEndDate.value) {
                showToast("시작일과 종료일을 입력해주세요.", "error");
                return;
            }
            $$(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
            loadAll();
        });

        // 시간대별 날짜 선택
        elHourlyDateSelect.addEventListener("change", renderHourlyChart);

        // 사용자 검색
        elBtnUserSearch.addEventListener("click", applyUserFilter);
        elBtnUserClear.addEventListener("click", clearUserFilter);
        elUserBadgeRemove.addEventListener("click", clearUserFilter);
        elUserInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") applyUserFilter();
        });

        // 엑셀 다운로드
        var btnExport = $("#btnExport");
        if (btnExport) {
            btnExport.addEventListener("click", function () {
                var form = document.createElement("form");
                form.method = "POST";
                form.action = "/admin/statistics/export";

                var fields = { adminId: adminId, startDate: elStartDate.value, endDate: elEndDate.value };
                if (searchUserId) fields.userId = searchUserId;

                Object.keys(fields).forEach(function (key) {
                    var input = document.createElement("input");
                    input.type = "hidden";
                    input.name = key;
                    input.value = fields[key];
                    form.appendChild(input);
                });

                document.body.appendChild(form);
                form.submit();
                form.remove();
            });
        }

        // 로그아웃
        var btnLogout = $("#btnLogout");
        if (btnLogout) {
            btnLogout.addEventListener("click", function () {
                var fd = new FormData();
                fd.append("adminId", adminId);
                fetch("/admin/logout", { method: "POST", body: fd })
                    .then(function () {
                        sessionStorage.removeItem("adminId");
                        window.location.href = "/admin";
                    });
            });
        }

        // 사이드바 토글 (모바일)
        var btnToggle = $("#btnSidebarToggle");
        var sidebar = $("#sidebar");
        var overlay = $("#sidebarOverlay");
        if (btnToggle) {
            btnToggle.addEventListener("click", function () {
                sidebar.classList.toggle("open");
                overlay.classList.toggle("show");
            });
        }
        if (overlay) {
            overlay.addEventListener("click", function () {
                sidebar.classList.remove("open");
                overlay.classList.remove("show");
            });
        }

        bindScreenGuide();
    }

    /* ───── 초기화 ───── */
    function init() {
        if (!checkSession()) return;
        adminId = sessionStorage.getItem("adminId") || "";
        setDateRange(7);
        bindEvents();
        loadAll();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
