// 관리자 환경설정 화면. Temperature 슬라이더 / 사용자 프롬프트 / 개인문서 보관기간 로드·저장.
(function () {
    "use strict";

    function $(sel) { return document.querySelector(sel); }

    var adminId = sessionStorage.getItem("adminId") || "";

    var dom = {
        temperature: null,
        temperatureValue: null,
        userPrompt: null,
        docRetentionDays: null,
        btnSave: null,
        loading: null,
    };

    function toast(msg, type) {
        var container = document.getElementById("toastContainer");
        if (!container) return;
        var el = document.createElement("div");
        el.className = "toast " + (type || "");
        el.innerHTML = '<span class="toast-text">' + msg + "</span>";
        container.appendChild(el);
        setTimeout(function () {
            el.classList.add("removing");
            el.addEventListener("animationend", function () { el.remove(); });
        }, 3000);
    }

    function showLoading(on) {
        // master.css의 .loading-overlay는 .show 클래스로 표시(opacity/visibility) 제어
        if (dom.loading) dom.loading.classList.toggle("show", on);
    }

    function syncSliderReadout() {
        if (dom.temperatureValue && dom.temperature) {
            var v = parseFloat(dom.temperature.value);
            dom.temperatureValue.textContent = isNaN(v) ? dom.temperature.value : v.toFixed(1);
        }
    }

    // 게이트웨이 계약: { file_ttl_days, temperature(소수), system_prompt }
    function loadConfig() {
        showLoading(true);
        fetch("/at-i/config/load", { method: "POST" })
            .then(function (r) {
                if (!r.ok) throw new Error("load failed: " + r.status);
                return r.json();
            })
            .then(function (c) {
                if (dom.temperature) dom.temperature.value = (c.temperature != null ? c.temperature : 0.3);
                syncSliderReadout();
                if (dom.userPrompt) dom.userPrompt.value = c.system_prompt || "";
                if (dom.docRetentionDays) {
                    var ttl = c.file_ttl_days != null ? Math.round(Number(c.file_ttl_days)) : 7;
                    dom.docRetentionDays.value = (isNaN(ttl) || ttl < 1) ? 7 : ttl;
                }
            })
            .catch(function () { toast("설정을 불러오지 못했습니다.", "error"); })
            .finally(function () { showLoading(false); });
    }

    function saveConfig() {
        var days = parseInt(dom.docRetentionDays.value, 10);
        if (isNaN(days) || days < 1) {
            toast("보관 기간은 1일 이상이어야 합니다.", "error");
            dom.docRetentionDays.focus();
            return;
        }
        var temp = parseFloat(dom.temperature.value);

        var payload = {
            file_ttl_days: days,
            temperature: isNaN(temp) ? 0.3 : temp,
            system_prompt: dom.userPrompt.value || "",
        };

        dom.btnSave.disabled = true;
        dom.btnSave.textContent = "저장 중...";

        fetch("/at-i/config/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
            .then(function (res) {
                if (res.ok) {
                    toast("설정이 저장되었습니다.", "success");
                } else {
                    toast("저장에 실패했습니다.", "error");
                }
            })
            .catch(function () { toast("서버 오류가 발생했습니다.", "error"); })
            .finally(function () {
                dom.btnSave.disabled = false;
                dom.btnSave.textContent = "저장";
            });
    }

    function bindCommon() {
        var btnLogout = $("#btnLogout");
        if (btnLogout) {
            btnLogout.addEventListener("click", function () {
                var fd = new FormData();
                fd.append("adminId", adminId);
                fetch("/at-i/logout", { method: "POST", body: fd })
                    .then(function () {
                        sessionStorage.removeItem("adminId");
                        window.location.href = "/at-i";
                    });
            });
        }

        var btnToggle = $("#btnSidebarToggle");
        var sidebar = $("#sidebar");
        var overlay = $("#sidebarOverlay");
        if (btnToggle && sidebar && overlay) {
            btnToggle.addEventListener("click", function () {
                sidebar.classList.toggle("open");
                overlay.classList.toggle("show");
            });
            overlay.addEventListener("click", function () {
                sidebar.classList.remove("open");
                overlay.classList.remove("show");
            });
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        // 세션 검증 + 헤더 사용자 표시 + 세션 만료 카운트다운 시작(common.js)
        if (typeof checkSession === "function" && !checkSession()) return;

        dom.temperature = $("#temperature");
        dom.temperatureValue = $("#temperatureValue");
        dom.userPrompt = $("#userPrompt");
        dom.docRetentionDays = $("#docRetentionDays");
        dom.btnSave = $("#btnSaveConfig");
        dom.loading = $("#loadingOverlay");

        if (dom.temperature) dom.temperature.addEventListener("input", syncSliderReadout);
        if (dom.btnSave) dom.btnSave.addEventListener("click", saveConfig);

        bindCommon();
        loadConfig();
    });
})();
