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
    var currentTarget = "";                             // "" = 파티션 전체(dept), name = 파티션
    var partitions = [];                               // 현재 dept의 파티션 목록
    var overriddenPartitions = new Set();              // 개별 설정(override)을 가진 파티션 name 집합
    var pendingDiscard = null;                         // 저장 안 함 확인 모달 대기 액션 {onOk, onCancel}

    // 저장하지 않은 변경 경고 모달. onOk=계속(변경 폐기 후 진행), onCancel=취소(원복 등).
    function askDiscard(onOk, onCancel) {
        if (!dom.discardModal) { if (onOk) onOk(); return; }   // 모달 없으면 그냥 진행(폴백)
        pendingDiscard = { onOk: onOk, onCancel: onCancel || null };
        dom.discardModal.classList.add("show");
    }
    function closeDiscard(runCancel) {
        if (dom.discardModal) dom.discardModal.classList.remove("show");
        var pd = pendingDiscard; pendingDiscard = null;
        if (runCancel && pd && pd.onCancel) pd.onCancel();
    }
    function confirmDiscard() {
        if (dom.discardModal) dom.discardModal.classList.remove("show");
        var pd = pendingDiscard; pendingDiscard = null;
        if (pd && pd.onOk) pd.onOk();
    }

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

    // 파티션별 설정 — 게이트웨이 /{dept}/admin/partitions/{partition}/settings
    function fetchPartitionSettings(dept, col) {
        return fetch("/at-i/config/partition/load?dept=" + encodeURIComponent(dept)
            + "&partition=" + encodeURIComponent(col), { method: "POST" })
            .then(function (r) { if (!r.ok) throw new Error("col load: " + r.status); return r.json(); });
    }
    function postPartitionSettings(dept, col, payload) {
        return fetch("/at-i/config/partition/save?dept=" + encodeURIComponent(dept)
            + "&partition=" + encodeURIComponent(col), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    // 현재 dept의 파티션 목록을 불러와 설정 대상 칩을 갱신
    function loadPartitionsForConfig(dept) {
        return fetch("/at-i/partitions/list", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "dept=" + encodeURIComponent(dept) + "&adminId=" + encodeURIComponent(adminId),
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                partitions = (res && String(res.code) === "0000") ? (res.partitions || []) : [];
                partitions.sort(function (a, b) { return (a.order != null ? a.order : (a.seq || 0)) - (b.order != null ? b.order : (b.seq || 0)); });
                // 현재 대상이 목록에 없으면 파티션 전체로 되돌림
                if (currentTarget && !partitions.some(function (x) { return String(x.name) === currentTarget; })) {
                    currentTarget = "";
                }
                renderTargetChips();
            })
            .catch(function () { partitions = []; renderTargetChips(); });
    }

    var ICON_ALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>';

    // 설정 대상 칩 렌더 — '기본(전체)'과 '파티션별'을 그룹 라벨 + 세로 구분선으로 구분.
    function renderTargetChips() {
        var box = dom.settingTargetChips;
        if (!box) return;
        box.innerHTML = "";

        function makeChip(value, label, isAll) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "config-chip" + (isAll ? " is-all" : "") + (value === currentTarget ? " active" : "");
            if (isAll) {
                b.innerHTML = ICON_ALL + "<span></span>";
                b.querySelector("span").textContent = label;
            } else {
                b.appendChild(document.createTextNode(label));
                if (overriddenPartitions.has(value)) {
                    b.title = "이 파티션은 개별 설정이 적용됩니다";
                    var dot = document.createElement("span");
                    dot.className = "chip-dot";
                    b.appendChild(dot);
                }
            }
            b.addEventListener("click", function () {
                if (currentTarget === value) return;
                var doSwitch = function () { currentTarget = value; renderTargetChips(); loadTarget(); };
                if (isDirty()) askDiscard(doSwitch);
                else doSwitch();
            });
            return b;
        }

        function group(labelText, grow) {
            var g = document.createElement("div");
            g.className = "tgt-group" + (grow ? " tgt-group--grow" : "");
            var lab = document.createElement("div");
            lab.className = "tgt-glabel";
            lab.textContent = labelText;
            var chips = document.createElement("div");
            chips.className = "tgt-gchips";
            g.appendChild(lab);
            g.appendChild(chips);
            box.appendChild(g);
            return chips;
        }

        // 기본(전체) 그룹 — 축소 안 됨(전체 칩 잘림 방지)
        var baseChips = group("기본", false);
        baseChips.appendChild(makeChip("", "전체", true));

        // 세로 구분선
        var divider = document.createElement("div");
        divider.className = "tgt-divider";
        box.appendChild(divider);

        // 파티션별 그룹 — 이 그룹만 축소·가로 스크롤
        var partChips = group("파티션별", true);
        if (partitions.length) {
            partitions.forEach(function (it) {
                partChips.appendChild(makeChip(String(it.name), it.description || it.name, false));
            });
        } else {
            var empty = document.createElement("span");
            empty.className = "tgt-empty";
            empty.textContent = "파티션 없음";
            partChips.appendChild(empty);
        }
        updateResetBtn();
    }

    // '파티션 설정 초기화' 버튼은 특정 파티션이 선택됐을 때만 노출(전체는 초기화 대상 아님).
    function updateResetBtn() {
        if (dom.btnReset) dom.btnReset.style.display = currentTarget ? "" : "none";
    }

    function openResetModal() {
        if (!currentTarget) return;
        if (dom.resetModal) dom.resetModal.classList.add("show");
    }
    function closeReset() {
        if (dom.resetModal) dom.resetModal.classList.remove("show");
    }
    // 초기화: temperature·system_prompt를 null로 저장 → 게이트웨이가 개별 설정을 지우고 전체 설정을 따름.
    function doResetConfig() {
        var target = currentTarget;
        if (!target) { closeReset(); return; }
        if (dom.resetOk) { dom.resetOk.disabled = true; dom.resetOk.textContent = "초기화 중..."; }
        postPartitionSettings(currentDept(), target, { temperature: null, system_prompt: null })
            .then(function (res) {
                if (res.ok) {
                    toast("파티션 설정이 초기화되었습니다.", "success");
                    closeReset();
                    loadTarget();            // 초기화 후 전체 상속값으로 갱신
                    refreshOverrideMarks();  // 개별설정 점 배지 갱신
                } else {
                    toast("초기화에 실패했습니다.", "error");
                }
            })
            .catch(function () { toast("서버 오류가 발생했습니다.", "error"); })
            .finally(function () { if (dom.resetOk) { dom.resetOk.disabled = false; dom.resetOk.textContent = "초기화"; } });
    }

    // 파티션 설정 응답에 개별 오버라이드가 있는지(temperature 지정 또는 system_prompt 비어있지 않음).
    function hasOverride(c) {
        if (!c) return false;
        if (c.temperature != null) return true;
        return !!(c.system_prompt && String(c.system_prompt).trim() !== "");
    }

    // 각 파티션의 설정을 병렬 조회해 override 여부를 판정하고 칩 배지를 갱신.
    function refreshOverrideMarks() {
        var dept = currentDept();
        var names = partitions.map(function (it) { return String(it.name); });
        overriddenPartitions = new Set();
        if (!names.length) { renderTargetChips(); return; }
        Promise.all(names.map(function (name) {
            return fetchPartitionSettings(dept, name)
                .then(function (c) { if (hasOverride(c)) overriddenPartitions.add(name); })
                .catch(function () { /* 개별 조회 실패는 무시(배지만 미표시) */ });
        })).then(function () { renderTargetChips(); });
    }

    // 현재 대상(파티션 전체/파티션)의 temperature·프롬프트 로드
    function loadTarget() {
        showLoading(true);
        var dept = currentDept();
        var p = currentTarget ? fetchPartitionSettings(dept, currentTarget) : fetchSettings(dept);
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

    // 초기 로드: 파티션 목록 → 현재 대상(파티션 전체)의 temperature/프롬프트 (보관기간은 전역이라 별도 로드)
    function loadConfig() {
        var dept = currentDept();
        prevDept = dept;
        currentTarget = "";
        loadPartitionsForConfig(dept).then(function () { loadTarget(); refreshOverrideMarks(); });
    }

    // 개인문서 보관기간(전역) — 게이트웨이 /admin/file-ttl
    function loadRetention() {
        fetch("/at-i/config/ttl/load", { method: "POST" })
            .then(function (r) { if (!r.ok) throw new Error("ttl load " + r.status); return r.json(); })
            .then(applyRetention)
            .catch(function () { /* 보관기간 로드 실패는 조용히(기본값 유지) */ });
    }

    // dept 전환: 파티션 목록 재로드 + 대상을 파티션 전체로 초기화하고 설정 로드
    function onDeptChange() {
        var target = dom.deptSelect.value;
        var doChange = function () {
            prevDept = target;
            currentTarget = "";
            loadPartitionsForConfig(target).then(function () { loadTarget(); refreshOverrideMarks(); });
        };
        // 취소 시 select 값을 이전 선택으로 원복
        if (isDirty()) askDiscard(doChange, function () { dom.deptSelect.value = prevDept; });
        else doChange();
    }

    // 저장: 선택 대상(파티션 전체/파티션)의 temperature/시스템 프롬프트만.
    // (보관기간은 게이트웨이 per-dept 저장이 거부 → 전용 API로 별도 처리)
    function saveConfig() {
        var temp = parseFloat(dom.temperature.value);
        var dept = currentDept();
        var payload = { temperature: isNaN(temp) ? 0.3 : temp, system_prompt: dom.userPrompt.value || "" };

        dom.btnSave.disabled = true;
        dom.btnSave.textContent = "저장 중...";

        var save = currentTarget ? postPartitionSettings(dept, currentTarget, payload) : postSettings(dept, payload);
        save
            .then(function (res) {
                if (res.ok) {
                    toast("설정이 저장되었습니다.", "success");
                    loaded.temperature = dom.temperature.value;
                    loaded.system_prompt = dom.userPrompt.value;
                    // 파티션 개별 저장 시 그 파티션은 이제 개별 설정 보유 → 배지 갱신
                    if (currentTarget) { overriddenPartitions.add(currentTarget); renderTargetChips(); }
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
        dom.discardModal = $("#discardModal");
        dom.discardOk = $("#discardOk");
        dom.discardCancel = $("#discardCancel");
        dom.btnReset = $("#btnResetConfig");
        dom.resetModal = $("#resetModal");
        dom.resetOk = $("#resetOk");
        dom.resetCancel = $("#resetCancel");

        if (dom.temperature) dom.temperature.addEventListener("input", syncSliderReadout);
        if (dom.deptSelect) dom.deptSelect.addEventListener("change", onDeptChange);
        if (dom.btnSave) dom.btnSave.addEventListener("click", saveConfig);
        if (dom.btnSaveGlobal) dom.btnSaveGlobal.addEventListener("click", saveGlobalConfig);
        if (dom.discardOk) dom.discardOk.addEventListener("click", confirmDiscard);
        if (dom.discardCancel) dom.discardCancel.addEventListener("click", function () { closeDiscard(true); });
        if (dom.discardModal) dom.discardModal.addEventListener("click", function (e) {
            if (e.target === dom.discardModal) closeDiscard(true);
        });
        if (dom.btnReset) dom.btnReset.addEventListener("click", openResetModal);
        if (dom.resetOk) dom.resetOk.addEventListener("click", doResetConfig);
        if (dom.resetCancel) dom.resetCancel.addEventListener("click", closeReset);
        if (dom.resetModal) dom.resetModal.addEventListener("click", function (e) {
            if (e.target === dom.resetModal) closeReset();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key !== "Escape") return;
            if (dom.discardModal && dom.discardModal.classList.contains("show")) closeDiscard(true);
            if (dom.resetModal && dom.resetModal.classList.contains("show")) closeReset();
        });

        bindCommon();
        loadConfig();
        loadRetention();
        loadLocalConfig();

        // 화면 가이드(공용 common.js)
        if (typeof window.initAdminScreenGuide === "function") {
            window.initAdminScreenGuide([
                { selector: "#settingTargetSection", title: "설정 대상", text: "파티션 전체(기본) 또는 특정 파티션을 골라 편집합니다. ● 표시는 개별 설정이 있는 파티션입니다." },
                { selector: ".slider-block", title: "Temperature", text: "답변의 창의성/일관성 수준을 조절합니다. 낮을수록 일관적, 높을수록 창의적." },
                { selector: "#userPrompt", title: "시스템 프롬프트", text: "AI의 역할·말투·답변 기준을 지정합니다." },
                { selector: "#btnResetConfig", title: "파티션 설정 초기화", text: "선택한 파티션의 개별 설정을 지우고 전체 설정을 따르게 합니다. (특정 파티션 선택 시 노출)" },
                { selector: "#btnSaveConfig", title: "설정 저장", text: "선택한 대상(전체/파티션)에 Temperature·프롬프트를 저장합니다." },
                { selector: "#docRetentionDays", title: "개인문서 보관 기간", text: "업로드 파일의 보관 일수입니다. 모든 파티션 공통(전역)." },
                { selector: "#maxDocs", title: "업로드 개수 제한", text: "개인문서 최대 보관 개수입니다(0=무제한). 모든 파티션 공통(전역)." },
                { selector: "#btnSaveGlobal", title: "전역 설정 저장", text: "보관 기간·업로드 개수 제한을 저장합니다." }
            ]);
        }
    });
})();
