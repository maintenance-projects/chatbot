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
        maxDocs: null,
        deptSelect: null,
        btnSave: null,
        btnSaveGlobal: null,
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
    // temperature/system_prompt는 파티션(dept)별, file_ttl_days(보관기간)는 전역(기본 dept 기준).
    var defaultDept = window.CONFIG_DEFAULT_DEPT || "";
    var prevDept = "";                                  // dept 전환 취소 시 복원용
    var loaded = { temperature: null, system_prompt: null }; // 미저장 변경 감지용(선택 dept 기준)

    function currentDept() {
        return (dom.deptSelect && dom.deptSelect.value) || defaultDept || "";
    }

    function fetchSettings(dept) {
        return fetch("/at-i/config/load?dept=" + encodeURIComponent(dept), { method: "POST" })
            .then(function (r) { if (!r.ok) throw new Error("load failed: " + r.status); return r.json(); });
    }
    function postSettings(dept, payload) {
        return fetch("/at-i/config/save?dept=" + encodeURIComponent(dept), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    function applyDeptFields(c) {
        if (dom.temperature) dom.temperature.value = (c.temperature != null ? c.temperature : 0.3);
        syncSliderReadout();
        if (dom.userPrompt) dom.userPrompt.value = c.system_prompt || "";
        loaded.temperature = dom.temperature ? dom.temperature.value : null;
        loaded.system_prompt = dom.userPrompt ? dom.userPrompt.value : null;
    }
    function applyRetention(c) {
        if (!dom.docRetentionDays) return;
        var ttl = c.file_ttl_days != null ? Math.round(Number(c.file_ttl_days)) : 7;
        dom.docRetentionDays.value = (isNaN(ttl) || ttl < 1) ? 7 : ttl;
    }
    function isDirty() {
        if (!dom.temperature || !dom.userPrompt) return false;
        return dom.temperature.value !== loaded.temperature || dom.userPrompt.value !== loaded.system_prompt;
    }

    // 초기 로드: 선택 dept의 temperature/프롬프트 + 전역 보관기간(기본 dept)
    function loadConfig() {
        showLoading(true);
        var dept = currentDept();
        prevDept = dept;
        var p = fetchSettings(dept).then(function (c) {
            applyDeptFields(c);
            if (dept === defaultDept) applyRetention(c); // 기본 dept면 한 응답으로 보관기간까지
        });
        if (dept !== defaultDept) {
            p = p.then(function () { return fetchSettings(defaultDept).then(applyRetention); });
        }
        p.catch(function () { toast("설정을 불러오지 못했습니다.", "error"); })
            .finally(function () { showLoading(false); });
    }

    // dept 전환: 해당 파티션의 temperature/프롬프트만 재로드(보관기간은 전역이라 유지)
    function loadDeptOnly(dept) {
        showLoading(true);
        fetchSettings(dept).then(applyDeptFields)
            .catch(function () { toast("설정을 불러오지 못했습니다.", "error"); })
            .finally(function () { showLoading(false); });
    }

    function onDeptChange() {
        if (isDirty() && !confirm("저장하지 않은 변경이 있습니다. 파티션을 바꾸면 사라집니다. 계속할까요?")) {
            dom.deptSelect.value = prevDept; // 취소 → 이전 선택 복원
            return;
        }
        prevDept = dom.deptSelect.value;
        loadDeptOnly(dom.deptSelect.value);
    }

    // 저장: 선택 파티션의 temperature/시스템 프롬프트만.
    // (보관기간은 게이트웨이 per-dept 저장이 거부 → 전용 API 나오면 별도 처리)
    function saveConfig() {
        var temp = parseFloat(dom.temperature.value);
        var dept = currentDept();
        var payload = { temperature: isNaN(temp) ? 0.3 : temp, system_prompt: dom.userPrompt.value || "" };

        dom.btnSave.disabled = true;
        dom.btnSave.textContent = "저장 중...";

        postSettings(dept, payload)
            .then(function (res) {
                if (res.ok) {
                    toast("설정이 저장되었습니다.", "success");
                    loaded.temperature = dom.temperature.value;
                    loaded.system_prompt = dom.userPrompt.value;
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

    // 로컬 설정(게이트웨이 무관): 개인문서 업로드 개수 제한
    function loadLocalConfig() {
        fetch("/at-i/config/local/load", { method: "POST" })
            .then(function (r) { if (!r.ok) throw new Error("local load " + r.status); return r.json(); })
            .then(function (c) {
                if (dom.maxDocs) dom.maxDocs.value = (c.maxDocs != null ? c.maxDocs : 0);
            })
            .catch(function () { /* 로컬 설정 로드 실패는 조용히(기본 0=무제한) */ });
    }

    function saveGlobalConfig() {
        var max = parseInt(dom.maxDocs.value, 10);
        if (isNaN(max) || max < 0) {
            toast("업로드 개수 제한은 0 이상이어야 합니다. (0 = 무제한)", "error");
            dom.maxDocs.focus();
            return;
        }
        dom.btnSaveGlobal.disabled = true;
        dom.btnSaveGlobal.textContent = "저장 중...";
        fetch("/at-i/config/local/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ maxDocs: max }),
        })
            .then(function (res) {
                toast(res.ok ? "전역 설정이 저장되었습니다." : "저장에 실패했습니다.", res.ok ? "success" : "error");
            })
            .catch(function () { toast("서버 오류가 발생했습니다.", "error"); })
            .finally(function () {
                dom.btnSaveGlobal.disabled = false;
                dom.btnSaveGlobal.textContent = "저장";
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
        dom.maxDocs = $("#maxDocs");
        dom.deptSelect = $("#deptSelect");
        dom.btnSave = $("#btnSaveConfig");
        dom.btnSaveGlobal = $("#btnSaveGlobal");
        dom.loading = $("#loadingOverlay");

        if (dom.temperature) dom.temperature.addEventListener("input", syncSliderReadout);
        if (dom.deptSelect) dom.deptSelect.addEventListener("change", onDeptChange);
        if (dom.btnSave) dom.btnSave.addEventListener("click", saveConfig);
        if (dom.btnSaveGlobal) dom.btnSaveGlobal.addEventListener("click", saveGlobalConfig);

        bindCommon();
        loadConfig();
        loadLocalConfig();
    });
})();
