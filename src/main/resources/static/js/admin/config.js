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
    var loaded = { temperature: null, system_prompt: null }; // 미저장 변경 감지용(선택 대상 기준)
    var currentTarget = "";                             // "" = 파티션 전체(dept), name = 콜렉션
    var collections = [];                               // 현재 dept의 콜렉션 목록

    function currentDept() {
        return (dom.deptSelect && dom.deptSelect.value) || defaultDept || "";
    }

    // 파티션(dept) 전체 설정 — 게이트웨이 /admin/settings/{dept}
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

    // 콜렉션별 설정 — 게이트웨이 /{dept}/admin/partitions/{collection}/settings
    function fetchCollectionSettings(dept, col) {
        return fetch("/at-i/config/collection/load?dept=" + encodeURIComponent(dept)
            + "&collection=" + encodeURIComponent(col), { method: "POST" })
            .then(function (r) { if (!r.ok) throw new Error("col load: " + r.status); return r.json(); });
    }
    function postCollectionSettings(dept, col, payload) {
        return fetch("/at-i/config/collection/save?dept=" + encodeURIComponent(dept)
            + "&collection=" + encodeURIComponent(col), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    // 현재 dept의 콜렉션 목록을 불러와 설정 대상 칩을 갱신
    function loadCollectionsForConfig(dept) {
        return fetch("/at-i/partitions/list", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "dept=" + encodeURIComponent(dept) + "&adminId=" + encodeURIComponent(adminId),
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                collections = (res && String(res.code) === "0000") ? (res.partitions || []) : [];
                collections.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
                // 현재 대상이 목록에 없으면 파티션 전체로 되돌림
                if (currentTarget && !collections.some(function (x) { return String(x.name) === currentTarget; })) {
                    currentTarget = "";
                }
                renderTargetChips();
            })
            .catch(function () { collections = []; renderTargetChips(); });
    }

    // 설정 대상 칩(파티션 전체 + 콜렉션별) 렌더
    function renderTargetChips() {
        var box = dom.settingTargetChips;
        if (!box) return;
        box.innerHTML = "";
        function chip(value, label) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "config-chip" + (value === currentTarget ? " active" : "");
            b.textContent = label;
            b.addEventListener("click", function () {
                if (currentTarget === value) return;
                if (isDirty() && !confirm("저장하지 않은 변경이 있습니다. 대상을 바꾸면 사라집니다. 계속할까요?")) return;
                currentTarget = value;
                renderTargetChips();
                loadTarget();
            });
            box.appendChild(b);
        }
        chip("", "파티션 전체");
        collections.forEach(function (it) { chip(String(it.name), it.description || it.name); });
    }

    // 현재 대상(파티션 전체/콜렉션)의 temperature·프롬프트 로드
    function loadTarget() {
        showLoading(true);
        var dept = currentDept();
        var p = currentTarget ? fetchCollectionSettings(dept, currentTarget) : fetchSettings(dept);
        p.then(applyDeptFields)
            .catch(function () { toast("설정을 불러오지 못했습니다.", "error"); })
            .finally(function () { showLoading(false); });
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

    // 초기 로드: 콜렉션 목록 → 현재 대상(파티션 전체)의 temperature/프롬프트 (보관기간은 전역이라 별도 로드)
    function loadConfig() {
        var dept = currentDept();
        prevDept = dept;
        currentTarget = "";
        loadCollectionsForConfig(dept).then(loadTarget);
    }

    // 개인문서 보관기간(전역) — 게이트웨이 /admin/file-ttl
    function loadRetention() {
        fetch("/at-i/config/ttl/load", { method: "POST" })
            .then(function (r) { if (!r.ok) throw new Error("ttl load " + r.status); return r.json(); })
            .then(applyRetention)
            .catch(function () { /* 보관기간 로드 실패는 조용히(기본값 유지) */ });
    }

    // dept 전환: 콜렉션 목록 재로드 + 대상을 파티션 전체로 초기화하고 설정 로드
    function onDeptChange() {
        if (isDirty() && !confirm("저장하지 않은 변경이 있습니다. 파티션을 바꾸면 사라집니다. 계속할까요?")) {
            dom.deptSelect.value = prevDept; // 취소 → 이전 선택 복원
            return;
        }
        prevDept = dom.deptSelect.value;
        currentTarget = "";
        loadCollectionsForConfig(dom.deptSelect.value).then(loadTarget);
    }

    // 저장: 선택 대상(파티션 전체/콜렉션)의 temperature/시스템 프롬프트만.
    // (보관기간은 게이트웨이 per-dept 저장이 거부 → 전용 API로 별도 처리)
    function saveConfig() {
        var temp = parseFloat(dom.temperature.value);
        var dept = currentDept();
        var payload = { temperature: isNaN(temp) ? 0.3 : temp, system_prompt: dom.userPrompt.value || "" };

        dom.btnSave.disabled = true;
        dom.btnSave.textContent = "저장 중...";

        var save = currentTarget ? postCollectionSettings(dept, currentTarget, payload) : postSettings(dept, payload);
        save
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

    // 전역 설정 저장: 개인문서 보관기간(게이트웨이) + 업로드 개수 제한(로컬)
    function saveGlobalConfig() {
        var days = parseInt(dom.docRetentionDays.value, 10);
        if (isNaN(days) || days < 1) {
            toast("보관 기간은 1일 이상이어야 합니다.", "error");
            dom.docRetentionDays.focus();
            return;
        }
        var max = parseInt(dom.maxDocs.value, 10);
        if (isNaN(max) || max < 0) {
            toast("업로드 개수 제한은 0 이상이어야 합니다. (0 = 무제한)", "error");
            dom.maxDocs.focus();
            return;
        }
        dom.btnSaveGlobal.disabled = true;
        dom.btnSaveGlobal.textContent = "저장 중...";
        Promise.all([
            fetch("/at-i/config/ttl/save", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file_ttl_days: days }),
            }),
            fetch("/at-i/config/local/save", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maxDocs: max }),
            }),
        ])
            .then(function (results) {
                var ok = results.every(function (r) { return r.ok; });
                toast(ok ? "전역 설정이 저장되었습니다." : "일부 저장에 실패했습니다.", ok ? "success" : "error");
                if (ok) loadRetention(); // 게이트웨이가 값을 조정할 수 있어 실제 저장값 재조회
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
        dom.settingTargetChips = $("#settingTargetChips");
        dom.btnSave = $("#btnSaveConfig");
        dom.btnSaveGlobal = $("#btnSaveGlobal");
        dom.loading = $("#loadingOverlay");

        if (dom.temperature) dom.temperature.addEventListener("input", syncSliderReadout);
        if (dom.deptSelect) dom.deptSelect.addEventListener("change", onDeptChange);
        if (dom.btnSave) dom.btnSave.addEventListener("click", saveConfig);
        if (dom.btnSaveGlobal) dom.btnSaveGlobal.addEventListener("click", saveGlobalConfig);

        bindCommon();
        loadConfig();
        loadRetention();
        loadLocalConfig();
    });
})();
