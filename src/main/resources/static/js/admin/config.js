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
            dom.temperatureValue.textContent = dom.temperature.value;
        }
    }

    function loadConfig() {
        showLoading(true);
        fetch("/at-i/config/load", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } })
            .then(function (r) { return r.json(); })
            .then(function (c) {
                if (dom.temperature) dom.temperature.value = (c.temperature != null ? c.temperature : 5);
                syncSliderReadout();
                if (dom.userPrompt) dom.userPrompt.value = c.userPrompt || "";
                if (dom.docRetentionDays) dom.docRetentionDays.value = (c.docRetentionDays != null ? c.docRetentionDays : 7);
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

        var fd = new URLSearchParams();
        fd.append("temperature", dom.temperature.value);
        fd.append("userPrompt", dom.userPrompt.value);
        fd.append("docRetentionDays", String(days));

        dom.btnSave.disabled = true;
        dom.btnSave.textContent = "저장 중...";

        fetch("/at-i/config/save", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: fd.toString(),
        })
            .then(function (r) { return r.text(); })
            .then(function (result) {
                if ((result || "").trim() === "ok") {
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
