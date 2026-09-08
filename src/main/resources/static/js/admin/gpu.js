/* GPU 모니터링 — 실시간(폴링) + 이력(차트). 데이터: /at-i/gpu/current, /at-i/gpu/history */
(function () {
    if (typeof window.checkSession === "function" && !window.checkSession()) return;

    var adminId = sessionStorage.getItem("adminId") || "";

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    // ── 사이드바/로그아웃 ──
    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("sidebarOverlay");
    function toggleSidebar() {
        if (sidebar) sidebar.classList.toggle("open");
        if (overlay) overlay.classList.toggle("show");
    }
    var btnToggle = document.getElementById("btnSidebarToggle");
    if (btnToggle) btnToggle.addEventListener("click", toggleSidebar);
    if (overlay) overlay.addEventListener("click", toggleSidebar);
    var btnLogout = document.getElementById("btnLogout");
    if (btnLogout) btnLogout.addEventListener("click", function () {
        var fd = new FormData(); fd.append("adminId", adminId);
        fetch("/at-i/logout", { method: "POST", body: fd, credentials: "same-origin" })
            .finally(function () {
                sessionStorage.removeItem("userId"); sessionStorage.removeItem("adminId");
                window.location.href = "/at-i";
            });
    });

    // ── 탭 전환 ──
    var tabs = document.querySelectorAll(".gpu-tab");
    var panes = { live: document.getElementById("paneLive"), history: document.getElementById("paneHistory") };
    var historyLoaded = false;
    tabs.forEach(function (t) {
        t.addEventListener("click", function () {
            tabs.forEach(function (x) { x.classList.remove("active"); });
            t.classList.add("active");
            var tab = t.getAttribute("data-tab");
            Object.keys(panes).forEach(function (k) { if (panes[k]) panes[k].classList.toggle("active", k === tab); });
            if (tab === "history" && !historyLoaded) { historyLoaded = true; loadHistory(currentHours); }
        });
    });

    // ── 실시간 ──
    var cardsEl = document.getElementById("gpuCards");
    var liveMsg = document.getElementById("gpuLiveMsg");
    function pct(u, t) { return t > 0 ? Math.round(u * 100 / t) : 0; }
    function barClass(p) { return p >= 90 ? "danger" : (p >= 70 ? "warn" : ""); }
    function metric(label, valText, pctVal) {
        return '<div class="gpu-metric"><div class="gpu-metric__label"><span>' + label + '</span><b>' + esc(valText) + '</b></div>'
            + '<div class="gpu-bar"><div class="gpu-bar__fill ' + barClass(pctVal) + '" style="width:' + Math.min(100, pctVal) + '%"></div></div></div>';
    }
    var liveUpdated = document.getElementById("liveUpdated");
    function nowStr() {
        var d = new Date();
        function p(n) { return (n < 10 ? "0" : "") + n; }
        return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }
    var procsCard = document.getElementById("gpuProcsCard");
    var procsEl = document.getElementById("gpuProcs");
    function renderProcs(list) {
        if (!procsCard || !procsEl) return;
        procsCard.style.display = "block";
        if (!list || !list.length) {
            procsEl.innerHTML = '<div class="gpu-proc-empty">현재 GPU를 사용 중인 프로세스가 없습니다.</div>';
            return;
        }
        var rows = list.map(function (p) {
            return '<tr><td>' + esc(p.pid) + '</td><td>' + esc(p.name || '-') + '</td><td class="num">' + (p.memMB || 0).toLocaleString() + ' MB</td></tr>';
        }).join("");
        procsEl.innerHTML = '<table class="gpu-proc-table"><thead><tr><th>PID</th><th>프로세스</th><th style="text-align:right;">GPU 메모리</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
    var alertEl = document.getElementById("gpuAlert");
    function renderAlert(data) {
        if (!alertEl) return;
        var th = data.thresholds || { mem: 90, power: 90, util: 90 };
        var items = [];
        (data.gpus || []).forEach(function (g) {
            var mp = pct(g.memUsed, g.memTotal);
            var pw = g.powerLimit > 0 ? Math.round(g.powerDraw * 100 / g.powerLimit) : 0;
            if (mp >= th.mem) items.push("GPU" + g.index + " 메모리 " + mp + "% (임계 " + th.mem + "%)");
            if (pw >= th.power) items.push("GPU" + g.index + " 전력 " + pw + "% (임계 " + th.power + "%)");
            if (g.utilGpu >= th.util) items.push("GPU" + g.index + " 이용률 " + g.utilGpu + "% (임계 " + th.util + "%)");
        });
        if (!items.length) { alertEl.style.display = "none"; return; }
        alertEl.style.display = "block";
        alertEl.innerHTML = '<span class="gpu-alert__title">⚠ 임계 초과</span> 자원 부족 가능 — 확인이 필요합니다.<ul>'
            + items.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul>';
    }
    function renderLive(data) {
        if (liveUpdated) liveUpdated.textContent = "마지막 갱신: " + nowStr() + " (3초마다 자동)";
        if (!data || !data.available) {
            cardsEl.innerHTML = ""; liveMsg.style.display = "block";
            if (procsCard) procsCard.style.display = "none";
            if (alertEl) alertEl.style.display = "none";
            liveMsg.textContent = "GPU 정보를 가져올 수 없습니다" + (data && data.reason ? " (" + data.reason + ")" : "") + ".";
            return;
        }
        renderAlert(data);
        liveMsg.style.display = "none";
        cardsEl.innerHTML = (data.gpus || []).map(function (g) {
            var mp = pct(g.memUsed, g.memTotal);
            var pw = g.powerLimit > 0 ? Math.round(g.powerDraw * 100 / g.powerLimit) : 0;
            return '<div class="gpu-card">'
                + '<div class="gpu-card__title">GPU ' + g.index + ' · ' + esc(g.name) + '</div>'
                + '<div class="gpu-card__sub">온도 ' + g.temperature + '℃ · 팬 ' + g.fanSpeed + '% · 클럭 ' + g.smClock + '/' + g.smClockMax + ' MHz</div>'
                + metric("전력 (실사용 강도)", Math.round(g.powerDraw) + ' / ' + Math.round(g.powerLimit) + ' W (' + pw + '%)', pw)
                + metric("메모리", g.memUsed.toLocaleString() + ' / ' + g.memTotal.toLocaleString() + ' MB (' + mp + '%)', mp)
                + metric("이용률 (바쁜 시간)", g.utilGpu + '%', g.utilGpu)
                + '<div class="gpu-etc"><span>메모리 대역폭 <b>' + (g.memUtil || 0) + '%</b></span></div>'
                + '</div>';
        }).join("");
        renderProcs(data.processes);
    }
    function loadLive() {
        fetch("/at-i/gpu/current", { credentials: "same-origin" })
            .then(function (r) { return r.json(); }).then(renderLive)
            .catch(function () { cardsEl.innerHTML = ""; liveMsg.style.display = "block"; liveMsg.textContent = "GPU 정보를 불러오지 못했습니다."; });
    }
    loadLive();
    setInterval(loadLive, 3000);

    // ── 이력(차트) ──
    var currentHours = 24;
    var histMsg = document.getElementById("gpuHistMsg");
    var histNote = document.getElementById("histNote");
    var chartUtil = null, chartMem = null, chartPower = null, chartTemp = null, chartHour = null, chartDemand = null;
    var COLORS = ["#2563eb", "#27ae60", "#e67e22", "#8e44ad", "#e74c3c", "#16a085", "#f1c40f", "#34495e"];

    document.querySelectorAll(".hist-range").forEach(function (b) {
        b.addEventListener("click", function () {
            document.querySelectorAll(".hist-range").forEach(function (x) { x.classList.remove("active"); });
            b.classList.add("active");
            currentHours = parseInt(b.getAttribute("data-hours"), 10) || 24;
            loadHistory(currentHours);
        });
    });
    function seriesData(gpus, kind) {
        return (gpus || []).map(function (g, i) {
            var color = COLORS[i % COLORS.length];
            return {
                label: "GPU " + g.index, borderColor: color, backgroundColor: color,
                borderWidth: 1.6, pointRadius: 0, tension: 0.25,
                data: (g.points || []).map(function (p) {
                    if (kind === "memPct") return p.memTotal > 0 ? Math.round(p.memUsed * 100 / p.memTotal) : 0;
                    if (kind === "power") return p.power;
                    if (kind === "temp") return p.temp;
                    return p.util;
                })
            };
        });
    }
    function labelsOf(gpus) { return (gpus && gpus[0] && gpus[0].points) ? gpus[0].points.map(function (p) { return p.t; }) : []; }
    var histSummary = document.getElementById("histSummary");
    function cls(v) { return v >= 90 ? "danger" : (v >= 70 ? "warn" : ""); }
    function renderSummary(gpus) {
        if (!histSummary) return;
        histSummary.innerHTML = (gpus || []).map(function (g) {
            var s = g.summary || {};
            return '<div class="sum-card">'
                + '<div class="sum-card__title">GPU ' + g.index + ' · ' + esc(g.name) + ' — 기간 요약</div>'
                + row("이용률 최대", (s.maxUtil || 0) + "%", cls(s.maxUtil || 0))
                + row("이용률 평균", (s.avgUtil || 0) + "%", "")
                + row("메모리 최대", (s.maxMemPct || 0) + "%", cls(s.maxMemPct || 0))
                + row("메모리 평균", (s.avgMemPct || 0) + "%", "")
                + row("이용률 90%↑ 시간", (s.over90Ratio || 0) + "%", cls(s.over90Ratio || 0))
                + row("전력 최대", (s.maxPower || 0) + " W", "")
                + row("전력 평균", (s.avgPower || 0) + " W", "")
                + '</div>';
        }).join("");
    }
    function row(label, val, c) {
        return '<div class="sum-row"><span>' + label + '</span><b class="' + c + '">' + esc(val) + '</b></div>';
    }
    function drawChart(existing, canvasId, labels, ds, percent) {
        if (existing) { existing.data.labels = labels; existing.data.datasets = ds; existing.update(); return existing; }
        var ctx = document.getElementById(canvasId).getContext("2d");
        var y = (percent === false)
            ? { beginAtZero: true }
            : { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + "%"; } } };
        return new Chart(ctx, {
            type: "line", data: { labels: labels, datasets: ds },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                scales: { y: y, x: { ticks: { maxTicksLimit: 12, autoSkip: true } } },
                plugins: { legend: { position: "top" } }
            }
        });
    }
    function drawHour(pattern) {
        var labels = (pattern || []).map(function (p) { return p.hour + "시"; });
        var data = (pattern || []).map(function (p) { return p.avgUtil; });
        if (chartHour) { chartHour.data.labels = labels; chartHour.data.datasets[0].data = data; chartHour.update(); return; }
        var ctx = document.getElementById("chartHour").getContext("2d");
        chartHour = new Chart(ctx, {
            type: "bar",
            data: { labels: labels, datasets: [{ label: "평균 이용률", backgroundColor: "#2563eb", data: data }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + "%"; } } } },
                plugins: { legend: { display: false } }
            }
        });
    }
    function drawDemand(dvr) {
        dvr = dvr || [];
        var labels = dvr.map(function (p) { return (p.t || "").slice(5) + "시"; });
        var reqs = dvr.map(function (p) { return p.requests; });
        var mem = dvr.map(function (p) { return p.gpuMemPct; });
        var util = dvr.map(function (p) { return p.gpuUtil; });
        var ds = [
            { type: "bar", label: "요청수", data: reqs, backgroundColor: "rgba(37,99,235,0.35)", borderColor: "#2563eb", yAxisID: "yReq", order: 2 },
            { type: "line", label: "GPU 메모리%", data: mem, borderColor: "#e74c3c", backgroundColor: "#e74c3c", borderWidth: 1.8, pointRadius: 0, tension: 0.25, yAxisID: "yPct", order: 1 },
            { type: "line", label: "GPU 이용률%", data: util, borderColor: "#27ae60", backgroundColor: "#27ae60", borderWidth: 1.4, pointRadius: 0, tension: 0.25, yAxisID: "yPct", order: 1 }
        ];
        if (chartDemand) { chartDemand.data.labels = labels; chartDemand.data.datasets = ds; chartDemand.update(); return; }
        var ctx = document.getElementById("chartDemand").getContext("2d");
        chartDemand = new Chart(ctx, {
            data: { labels: labels, datasets: ds },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                scales: {
                    yReq: { position: "left", beginAtZero: true, title: { display: true, text: "요청수" } },
                    yPct: { position: "right", beginAtZero: true, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: function (v) { return v + "%"; } }, title: { display: true, text: "GPU %" } },
                    x: { ticks: { maxTicksLimit: 12, autoSkip: true } }
                },
                plugins: { legend: { position: "top" } }
            }
        });
    }
    function loadHistory(hours) {
        fetch("/at-i/gpu/history?hours=" + hours, { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var gpus = d.gpus || [];
                if (!gpus.length) { histMsg.style.display = "block"; histMsg.textContent = "이력 데이터가 없습니다(수집 시작 후 표시됩니다)."; if (histSummary) histSummary.innerHTML = ""; return; }
                histMsg.style.display = "none";
                histNote.textContent = d.aggregated ? "(차트: 시간 단위 평균 · 요약: 원자료 기준)" : "(1분 원자료)";
                renderSummary(gpus);
                var labels = labelsOf(gpus);
                chartUtil = drawChart(chartUtil, "chartUtil", labels, seriesData(gpus, "util"), true);
                chartMem = drawChart(chartMem, "chartMem", labels, seriesData(gpus, "memPct"), true);
                chartPower = drawChart(chartPower, "chartPower", labels, seriesData(gpus, "power"), false);
                chartTemp = drawChart(chartTemp, "chartTemp", labels, seriesData(gpus, "temp"), false);
                drawHour(d.hourPattern);
                drawDemand(d.demandVsResource);
            })
            .catch(function () { histMsg.style.display = "block"; histMsg.textContent = "이력을 불러오지 못했습니다."; });
    }
})();
