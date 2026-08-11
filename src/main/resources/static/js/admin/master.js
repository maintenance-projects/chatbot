(function () {
    "use strict";

    /* ───── 상태 ───── */
    var adminId = "";
    var adminList = [];
    var editMode = false;
    var deleteTargetId = null;
    var confirmCallback = null;

    /* ───── DOM ───── */
    var $ = function (sel) { return document.querySelector(sel); };

    var dom = {
        tableBody: null,
        tableInfo: null,
        searchField: null,
        searchInput: null,
        btnSearch: null,
        btnAddAdmin: null,
        adminModal: null,
        adminModalTitle: null,
        adminModalClose: null,
        adminModalCancel: null,
        adminModalSave: null,
        inputAdminId: null,
        inputAdminName: null,
        inputPassword: null,
        passwordGroup: null,
        inputIp: null,
        chkStorage: null,
        chkStatistics: null,
        chkMaster: null,
        formError: null,
        confirmModal: null,
        confirmTitle: null,
        confirmMsg: null,
        confirmCancel: null,
        confirmOk: null,
        loadingOverlay: null,
        statTotal: null
    };

    var elBtnScreenGuide = $("#btnScreenGuide");
    var elScreenGuideOverlay = $("#screenGuideOverlay");
    var elScreenGuideDim = $("#screenGuideDim");
    var elScreenGuideClose = $("#btnCloseScreenGuide");
    var elScreenGuideLayer = $("#screenGuideHighlightLayer");
    var isScreenGuideOpen = false;
    var guideItems = [
        { selector: ".stats-row", title: "요약 카드", text: "현재 등록된 전체 관리자 수를 확인합니다." },
        { selector: ".search-group", title: "계정 검색", text: "관리자 ID/이름 기준으로 대상을 빠르게 찾습니다." },
        { selector: "#btnAddAdmin", title: "계정 추가", text: "새 관리자 계정을 생성하고 초기 권한을 설정합니다." },
        { selector: ".table-wrap", title: "계정 목록", text: "권한, IP, 등록일을 확인하고 수정/삭제를 수행합니다." },
        { selector: "#adminTableBody", title: "행 동작 버튼", text: "각 계정별로 수정/삭제 작업을 실행합니다." }
    ];

    /* ───── 유틸 ───── */
    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function toast(msg, type) {
        var container = $("#toastContainer");
        if (!container) return;
        var el = document.createElement("div");
        el.className = "toast " + (type || "");
        el.innerHTML = '<span class="toast-text">' + msg + "</span>";
        container.appendChild(el);
        setTimeout(function () {
            el.classList.add("removing");
            el.addEventListener("animationend", function () { el.remove(); });
        }, 3500);
    }

    function showLoading(on) {
        if (dom.loadingOverlay) {
            dom.loadingOverlay.classList.toggle("show", on);
        }
    }

    function showFormError(msg) {
        dom.formError.textContent = msg;
        dom.formError.style.display = "";
    }

    function hideFormError() {
        dom.formError.textContent = "";
        dom.formError.style.display = "none";
    }

    function postData(url, params) {
        var fd = new FormData();
        fd.append("adminId", adminId);
        if (params) {
            Object.keys(params).forEach(function (k) { fd.append(k, params[k]); });
        }
        return fetch(url, { method: "POST", body: fd })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.text();
            });
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
            elScreenGuideLayer.appendChild(tooltip);

            var tooltipWidth = tooltip.offsetWidth || (window.innerWidth <= 768 ? 220 : 260);
            var tooltipHeight = tooltip.offsetHeight || 96;

            var candidates = [
                { left: rect.right + 10, top: rect.top },
                { left: rect.left - tooltipWidth - 10, top: rect.top },
                { left: rect.right + 10, top: rect.bottom - tooltipHeight },
                { left: rect.left - tooltipWidth - 10, top: rect.bottom - tooltipHeight },
                { left: rect.left, top: rect.bottom + 10 },
                { left: rect.left, top: rect.top - tooltipHeight - 10 }
            ];

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
        if (elScreenGuideClose) elScreenGuideClose.addEventListener("click", closeScreenGuide);
        if (elScreenGuideDim) elScreenGuideDim.addEventListener("click", closeScreenGuide);

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

    /* ───── 권한 뱃지 SVG ───── */
    var checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var xSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    function authBadge(val) {
        if (val === "1") {
            return '<span class="auth-badge on">' + checkSvg + '</span>';
        }
        return '<span class="auth-badge off">' + xSvg + '</span>';
    }

    /* ───── 테이블 렌더링 ───── */
    function renderTable() {
        if (adminList.length === 0) {
            dom.tableBody.innerHTML =
                '<tr><td colspan="9" class="center" style="padding:40px;color:var(--text-light);">등록된 계정이 없습니다.</td></tr>';
            dom.tableInfo.textContent = "";
            dom.statTotal.textContent = "0";
            return;
        }

        var html = "";
        adminList.forEach(function (a, i) {
            var isSelf = (a.adminId === adminId);
            html += "<tr>"
                + "<td>" + (i + 1) + "</td>"
                + "<td>" + escapeHtml(a.adminId) + (isSelf ? ' <span style="font-size:0.72rem;color:var(--text-light);">(나)</span>' : '') + "</td>"
                + "<td>" + escapeHtml(a.adminName || "") + "</td>"
                + "<td>" + escapeHtml(a.ip || "") + "</td>"
                + "<td>" + authBadge(a.authStorage) + "</td>"
                + "<td>" + authBadge(a.authStatistics) + "</td>"
                + "<td>" + authBadge(a.authMaster) + "</td>"
                + "<td>" + escapeHtml(a.regDate || "") + "</td>"
                + '<td><div class="action-btns">'
                + '<button class="btn-icon" title="수정" data-action="edit" data-id="' + escapeHtml(a.adminId) + '">'
                + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                + '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>'
                + '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'
                + '</svg></button>';

            if (!isSelf) {
                html += '<button class="btn-icon danger" title="삭제" data-action="delete" data-id="' + escapeHtml(a.adminId) + '">'
                    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                    + '<polyline points="3 6 5 6 21 6"/>'
                    + '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
                    + '</svg></button>';
            }

            html += '</div></td></tr>';
        });

        dom.tableBody.innerHTML = html;
        dom.tableInfo.innerHTML = "총 <strong>" + adminList.length + "</strong>건";
        dom.statTotal.textContent = adminList.length;
    }

    /* ───── 데이터 로드 ───── */
    function loadAdminList() {
        showLoading(true);
        postData("/at-i/master/list", {})
            .then(function (text) {
                adminList = JSON.parse(text);
                renderTable();
            })
            .catch(function () {
                toast("계정 목록을 불러올 수 없습니다.", "error");
            })
            .finally(function () { showLoading(false); });
    }

    function searchAdmins() {
        var keyword = dom.searchInput.value.trim();
        if (!keyword) {
            loadAdminList();
            return;
        }
        showLoading(true);
        postData("/at-i/master/search", {
            field: dom.searchField.value,
            keyword: keyword
        })
            .then(function (text) {
                adminList = JSON.parse(text);
                renderTable();
            })
            .catch(function () {
                toast("검색 중 오류가 발생했습니다.", "error");
            })
            .finally(function () { showLoading(false); });
    }

    /* ───── 모달 ───── */
    function openAddModal() {
        editMode = false;
        dom.adminModalTitle.textContent = "계정 추가";
        dom.inputAdminId.value = "";
        dom.inputAdminId.disabled = false;
        dom.inputAdminName.value = "";
        dom.inputPassword.value = "";
        dom.passwordGroup.style.display = "";
        dom.inputIp.value = "";
        dom.chkStorage.checked = false;
        dom.chkStatistics.checked = false;
        dom.chkMaster.checked = false;
        hideFormError();
        dom.adminModalSave.textContent = "추가";
        dom.adminModal.classList.add("show");
        setTimeout(function () { dom.inputAdminId.focus(); }, 200);
    }

    function openEditModal(targetId) {
        var admin = adminList.find(function (a) { return a.adminId === targetId; });
        if (!admin) return;
        editMode = true;
        dom.adminModalTitle.textContent = "계정 수정";
        dom.inputAdminId.value = admin.adminId;
        dom.inputAdminId.disabled = true;
        dom.inputAdminName.value = admin.adminName || "";
        dom.inputPassword.value = "";
        dom.passwordGroup.style.display = "none";
        dom.inputIp.value = admin.ip || "";
        dom.chkStorage.checked = admin.authStorage === "1";
        dom.chkStatistics.checked = admin.authStatistics === "1";
        dom.chkMaster.checked = admin.authMaster === "1";
        hideFormError();
        dom.adminModalSave.textContent = "수정";
        dom.adminModal.classList.add("show");
        setTimeout(function () { dom.inputAdminName.focus(); }, 200);
    }

    function closeAdminModal() {
        dom.adminModal.classList.remove("show");
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

    /* ───── CRUD ───── */
    function submitSave() {
        hideFormError();

        var targetId = dom.inputAdminId.value.trim();
        var targetName = dom.inputAdminName.value.trim();
        var ip = dom.inputIp.value.trim() || "0.0.0.0";

        if (!targetId) { showFormError("관리자 ID를 입력해주세요."); return; }
        if (!targetName) { showFormError("관리자명을 입력해주세요."); return; }

        if (!editMode) {
            var password = dom.inputPassword.value.trim();
            if (!password) { showFormError("비밀번호를 입력해주세요."); return; }

            dom.adminModalSave.disabled = true;
            dom.adminModalSave.textContent = "추가 중...";

            postData("/at-i/master/add", {
                targetId: targetId,
                targetName: targetName,
                password: password,
                ip: ip,
                authStorage: dom.chkStorage.checked ? "1" : "0",
                authStatistics: dom.chkStatistics.checked ? "1" : "0",
                authMaster: dom.chkMaster.checked ? "1" : "0"
            })
                .then(function (result) {
                    var r = (result || "").trim();
                    if (r === "ok") {
                        closeAdminModal();
                        toast("계정이 추가되었습니다.", "success");
                        loadAdminList();
                    } else if (r === "DuplicateId") {
                        showFormError("이미 존재하는 관리자 ID입니다.");
                    } else {
                        showFormError("계정 추가에 실패했습니다.");
                    }
                })
                .catch(function () { showFormError("서버 오류가 발생했습니다."); })
                .finally(function () {
                    dom.adminModalSave.disabled = false;
                    dom.adminModalSave.textContent = "추가";
                });
        } else {
            dom.adminModalSave.disabled = true;
            dom.adminModalSave.textContent = "수정 중...";

            postData("/at-i/master/update", {
                targetId: targetId,
                targetName: targetName,
                ip: ip,
                authStorage: dom.chkStorage.checked ? "1" : "0",
                authStatistics: dom.chkStatistics.checked ? "1" : "0",
                authMaster: dom.chkMaster.checked ? "1" : "0"
            })
                .then(function (result) {
                    var r = (result || "").trim();
                    if (r === "ok") {
                        closeAdminModal();
                        toast("계정이 수정되었습니다.", "success");
                        loadAdminList();
                    } else {
                        showFormError("계정 수정에 실패했습니다.");
                    }
                })
                .catch(function () { showFormError("서버 오류가 발생했습니다."); })
                .finally(function () {
                    dom.adminModalSave.disabled = false;
                    dom.adminModalSave.textContent = "수정";
                });
        }
    }

    function deleteAdmin(targetId) {
        openConfirm(
            "계정을 삭제하시겠습니까?",
            "'" + targetId + "' 계정이 삭제되며 복구할 수 없습니다.",
            function () {
                postData("/at-i/master/delete", { targetId: targetId })
                    .then(function (result) {
                        closeConfirm();
                        var r = (result || "").trim();
                        if (r === "ok") {
                            toast("계정이 삭제되었습니다.", "success");
                            loadAdminList();
                        } else if (r === "SelfDelete") {
                            toast("본인 계정은 삭제할 수 없습니다.", "error");
                        } else {
                            toast("계정 삭제에 실패했습니다.", "error");
                        }
                    })
                    .catch(function () {
                        closeConfirm();
                        toast("계정 삭제 중 오류가 발생했습니다.", "error");
                    });
            }
        );
    }

    /* ───── 이벤트 ───── */
    function bindEvents() {
        // 테이블 액션 (이벤트 위임)
        dom.tableBody.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-action]");
            if (!btn) return;
            var action = btn.dataset.action;
            var id = btn.dataset.id;
            if (action === "edit") openEditModal(id);
            if (action === "delete") deleteAdmin(id);
        });

        // 검색
        dom.btnSearch.addEventListener("click", searchAdmins);
        dom.searchInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") searchAdmins();
        });

        // 추가 버튼
        dom.btnAddAdmin.addEventListener("click", openAddModal);

        // 추가/수정 모달
        dom.adminModalClose.addEventListener("click", closeAdminModal);
        dom.adminModalCancel.addEventListener("click", closeAdminModal);
        dom.adminModalSave.addEventListener("click", submitSave);
        dom.adminModal.addEventListener("click", function (e) {
            if (e.target === dom.adminModal) closeAdminModal();
        });

        // 확인 모달
        dom.confirmCancel.addEventListener("click", closeConfirm);
        dom.confirmOk.addEventListener("click", function () {
            if (confirmCallback) confirmCallback();
        });
        dom.confirmModal.addEventListener("click", function (e) {
            if (e.target === dom.confirmModal) closeConfirm();
        });

        // ESC
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                if (dom.confirmModal.classList.contains("show")) { closeConfirm(); return; }
                if (dom.adminModal.classList.contains("show")) { closeAdminModal(); return; }
            }
        });

        // 로그아웃
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

        // 사이드바 토글
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

        // DOM 캐싱
        dom.tableBody = $("#adminTableBody");
        dom.tableInfo = $("#tableInfo");
        dom.searchField = $("#searchField");
        dom.searchInput = $("#searchInput");
        dom.btnSearch = $("#btnSearch");
        dom.btnAddAdmin = $("#btnAddAdmin");
        dom.adminModal = $("#adminModal");
        dom.adminModalTitle = $("#adminModalTitle");
        dom.adminModalClose = $("#adminModalClose");
        dom.adminModalCancel = $("#adminModalCancel");
        dom.adminModalSave = $("#adminModalSave");
        dom.inputAdminId = $("#inputAdminId");
        dom.inputAdminName = $("#inputAdminName");
        dom.inputPassword = $("#inputPassword");
        dom.passwordGroup = $("#passwordGroup");
        dom.inputIp = $("#inputIp");
        dom.chkStorage = $("#chkStorage");
        dom.chkStatistics = $("#chkStatistics");
        dom.chkMaster = $("#chkMaster");
        dom.formError = $("#formError");
        dom.confirmModal = $("#confirmModal");
        dom.confirmTitle = $("#confirmTitle");
        dom.confirmMsg = $("#confirmMsg");
        dom.confirmCancel = $("#confirmCancel");
        dom.confirmOk = $("#confirmOk");
        dom.loadingOverlay = $("#loadingOverlay");
        dom.statTotal = $("#statTotal");

        bindEvents();
        loadAdminList();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
