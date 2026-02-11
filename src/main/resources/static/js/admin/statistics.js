(function () {
    "use strict";

    /* ───── 상태 ───── */
    let dailyChart = null;
    let hourlyChart = null;
    let adminId = "";
    let searchUserId = "";

    /* ───── 타입 정의 ───── */
    var TYPES = ["CHAT", "DOCUMENT", "TEMPLATE", "DIALOG", "AUDIO"];
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
            TYPES.forEach(function (t) {
                var count = tc[t] || 0;
                var color = TYPE_COLORS[t] ? TYPE_COLORS[t].dot : "#999";
                html += '<div class="type-chip">'
                    + '<span class="type-dot" style="background:' + color + ';"></span>'
                    + '<span class="type-chip-label">' + t + '</span>'
                    + '<span class="type-chip-value">' + count.toLocaleString() + '</span>'
                    + '</div>';
            });
            elTypeSummary.innerHTML = html;
        }).catch(function () { showToast("요약 데이터를 불러올 수 없습니다.", "error"); });
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
            TYPES.forEach(function (t) {
                var data = labels.map(function (d) { return dateMap[d][t]; });
                var hasData = data.some(function (v) { return v > 0; });
                if (hasData) {
                    var c = TYPE_COLORS[t];
                    datasets.push({
                        label: t,
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
        TYPES.forEach(function (t) {
            var hasData = hourData[t].some(function (v) { return v > 0; });
            if (hasData) {
                var c = TYPE_COLORS[t];
                datasets.push({
                    label: t,
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
