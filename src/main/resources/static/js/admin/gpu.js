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
    function renderLive(data) {
        if (!data || !data.available) {
            cardsEl.innerHTML = ""; liveMsg.style.display = "block";
            liveMsg.textContent = "GPU 정보를 가져올 수 없습니다" + (data && data.reason ? " (" + data.reason + ")" : "") + ".";
            return;
        }
        liveMsg.style.display = "none";
        cardsEl.innerHTML = (data.gpus || []).map(function (g) {
            var mp = pct(g.memUsed, g.memTotal);
            return '<div class="gpu-card">'
                + '<div class="gpu-card__title">GPU ' + g.index + ' · ' + esc(g.name) + '</div>'
                + '<div class="gpu-card__sub">온도 ' + g.temperature + '℃ · 전력 ' + Math.round(g.powerDraw) + '/' + Math.round(g.powerLimit) + 'W</div>'
                + metric("이용률", g.utilGpu + '%', g.utilGpu)
                + metric("메모리", g.memUsed.toLocaleString() + ' / ' + g.memTotal.toLocaleString() + ' MB (' + mp + '%)', mp)
                + '</div>';
        }).join("");
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
    var chartUtil = null, chartMem = null;
    var COLORS = ["#2563eb", "#27ae60", "#e67e22", "#8e44ad", "#e74c3c", "#16a085", "#f1c40f", "#34495e"];

    document.querySelectorAll(".hist-range").forEach(function (b) {
        b.addEventListener("click", function () {
            document.querySelectorAll(".hist-range").forEach(function (x) { x.classList.remove("active"); });
            b.classList.add("active");
            currentHours = parseInt(b.getAttribute("data-hours"), 10) || 24;
            loadHistory(currentHours);
        });
    });
    function datasets(gpus, isMemPct) {
        return (gpus || []).map(function (g, i) {
            var color = COLORS[i % COLORS.length];
            return {
                label: "GPU " + g.index, borderColor: color, backgroundColor: color,
                borderWidth: 1.6, pointRadius: 0, tension: 0.25,
                data: (g.points || []).map(function (p) {
                    return isMemPct ? (p.memTotal > 0 ? Math.round(p.memUsed * 100 / p.memTotal) : 0) : p.util;
                })
            };
        });
    }
    function labelsOf(gpus) { return (gpus && gpus[0] && gpus[0].points) ? gpus[0].points.map(function (p) { return p.t; }) : []; }
    function drawChart(existing, canvasId, labels, ds) {
        if (existing) { existing.data.labels = labels; existing.data.datasets = ds; existing.update(); return existing; }
        var ctx = document.getElementById(canvasId).getContext("2d");
        return new Chart(ctx, {
            type: "line", data: { labels: labels, datasets: ds },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                scales: { y: { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + "%"; } } }, x: { ticks: { maxTicksLimit: 12, autoSkip: true } } },
                plugins: { legend: { position: "top" } }
            }
        });
    }
    function loadHistory(hours) {
        fetch("/at-i/gpu/history?hours=" + hours, { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var gpus = d.gpus || [];
                if (!gpus.length) { histMsg.style.display = "block"; histMsg.textContent = "이력 데이터가 없습니다(수집 시작 후 표시됩니다)."; return; }
                histMsg.style.display = "none";
                histNote.textContent = d.aggregated ? "(시간 단위 평균)" : "(1분 원자료)";
                var labels = labelsOf(gpus);
                chartUtil = drawChart(chartUtil, "chartUtil", labels, datasets(gpus, false));
                chartMem = drawChart(chartMem, "chartMem", labels, datasets(gpus, true));
            })
            .catch(function () { histMsg.style.display = "block"; histMsg.textContent = "이력을 불러오지 못했습니다."; });
    }
})();
