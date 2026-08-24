/**
 * 관리자 · AI 파티션 권한 (dept 탭 + 조직도 트리 + 접근 권한)
 * - 상단 탭: dept-a/dept-b (ultari.dept.codes)
 * - 트리: 인사DB msg_part(조직) + msg_user(사용자). 조직/사용자 체크로 해당 dept 권한 부여
 * - 조직 부여는 하위 상속, 사용자 체크 해제 시 상속분은 예외(DENY) 처리
 * API: POST /at-i/users/tree, /at-i/users/grant
 */
(function () {
    "use strict";

    // 공통 초기화(비밀번호 변경 모달 + 세션 타이머 바인딩). 세션 없으면 /at-i로 리다이렉트.
    if (typeof window.checkSession === "function" && window.checkSession() === false) return;

    var deptCodes = Array.isArray(window.deptCodes) ? window.deptCodes : [];
    var deptLabels = (window.deptLabels && typeof window.deptLabels === "object") ? window.deptLabels : {};
    var currentDept = deptCodes.length ? String(deptCodes[0]) : "";

    // 조직/사용자 아이콘(SVG)
    var ICON_PART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5"/><path d="M9 10h.01M15 10h.01M9 13h.01M15 13h.01"/></svg>';
    var ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

    function labelOf(code) { var l = deptLabels[code]; return (l && String(l).trim()) ? String(l) : String(code); }

    var dom = {
        tabs: document.getElementById("deptTabs"),
        tree: document.getElementById("treeRoot"),
        loading: document.getElementById("loadingOverlay"),
        search: document.getElementById("treeSearch"),
        btnExpand: document.getElementById("btnExpandAll"),
        btnCollapse: document.getElementById("btnCollapseAll"),
        btnLogout: document.getElementById("btnLogout"),
        labelInput: document.getElementById("deptLabelInput"),
        labelCode: document.getElementById("deptLabelCode"),
        btnSaveLabel: document.getElementById("btnSaveDeptLabel"),
    };

    // 트리/권한 상태
    var partsById = {}, childrenOf = {}, usersByPart = {}, userParts = {}, roots = [];
    var grantedParts, usersAllow, usersDeny;

    function adminId() {
        return sessionStorage.getItem("userId") || sessionStorage.getItem("adminId") || "";
    }
    function notify(m, t) { if (typeof window.toast === "function") window.toast(m, t || "success"); }
    // 오버레이 가시성은 .show 클래스로 제어(CSS .loading-overlay는 기본 opacity:0/visibility:hidden)
    function showLoading(on) { if (dom.loading) dom.loading.classList.toggle("show", !!on); }
    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function postForm(url, params) {
        var fd = new FormData();
        Object.keys(params).forEach(function (k) { fd.append(k, params[k]); });
        return fetch(url, { method: "POST", body: fd, credentials: "same-origin" });
    }

    // ── 탭 ────────────────────────────────────────────────────
    function renderTabs() {
        dom.tabs.innerHTML = "";
        deptCodes.forEach(function (code) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "dept-tab" + (String(code) === currentDept ? " active" : "");
            b.textContent = labelOf(code);
            b.addEventListener("click", function () {
                currentDept = String(code);
                renderTabs();
                syncLabelEditor();
                loadTree();
            });
            dom.tabs.appendChild(b);
        });
        syncLabelEditor();
    }

    // ── dept 표시 명칭 편집 ────────────────────────────────────
    function syncLabelEditor() {
        if (!dom.labelInput) return;
        var l = deptLabels[currentDept];
        // 폴백(코드==명칭)이면 미설정으로 간주해 빈칸
        dom.labelInput.value = (l && String(l) !== String(currentDept)) ? String(l) : "";
        if (dom.labelCode) dom.labelCode.textContent = currentDept;
    }
    function saveLabel() {
        if (!currentDept) return;
        var label = (dom.labelInput.value || "").trim();
        showLoading(true);
        postForm("/at-i/users/dept-label", { adminId: adminId(), dept: currentDept, label: label })
            .then(function (r) { return r.text(); })
            .then(function (t) {
                if (String(t || "").trim() === "ok") {
                    deptLabels[currentDept] = label || currentDept;
                    renderTabs();
                    notify("명칭이 저장되었습니다.", "success");
                } else { notify("명칭 저장 실패", "error"); }
            })
            .catch(function () { notify("명칭 저장 중 오류", "error"); })
            .finally(function () { showLoading(false); });
    }

    // ── 데이터 로드 ───────────────────────────────────────────
    function loadTree() {
        if (!currentDept) return;
        showLoading(true);
        postForm("/at-i/users/tree", { adminId: adminId(), dept: currentDept })
            .then(function (r) { return r.json(); })
            .then(function (data) { buildIndex(data); renderTree(); })
            .catch(function () { notify("트리를 불러오지 못했습니다.", "error"); dom.tree.innerHTML = ""; })
            .finally(function () { showLoading(false); });
    }

    function buildIndex(data) {
        partsById = {}; childrenOf = {}; usersByPart = {}; userParts = {}; roots = [];
        var parts = (data && data.parts) || [];
        var users = (data && data.users) || [];
        var g = (data && data.grants) || {};
        grantedParts = new Set(g.parts || []);
        usersAllow = new Set(g.usersAllow || []);
        usersDeny = new Set(g.usersDeny || []);

        parts.forEach(function (p) { partsById[p.partId] = p; });
        parts.forEach(function (p) {
            var high = String(p.partHigh == null ? "" : p.partHigh).trim();
            if (high === "0") {
                roots.push(p.partId);  // 최상위: HIGH == 0 인 부서만
            } else if (partsById[high] && high !== p.partId) {
                (childrenOf[high] = childrenOf[high] || []).push(p.partId);  // 존재하는 부모 밑 자식
            }
            // 그 외(HIGH≠0 인데 부모가 목록에 없음 = 고아, 자기참조): 트리에서 제외(숨김)
        });
        users.forEach(function (u) {
            (usersByPart[u.userHigh] = usersByPart[u.userHigh] || []).push(u);
            (userParts[u.userId] = userParts[u.userId] || new Set()).add(u.userHigh);
        });
    }

    // ── 상속 계산 ─────────────────────────────────────────────
    function ancestorsOf(partId) {
        var set = new Set(), cur = partId, guard = 0;
        while (cur && !set.has(cur) && guard++ < 100) { set.add(cur); cur = partsById[cur] ? partsById[cur].partHigh : null; }
        return set;
    }
    function partHasGrantedAncestor(partId) {
        var anc = ancestorsOf(partId);
        for (var a of anc) if (grantedParts.has(a)) return true;
        return false;
    }
    // 사용자가 조직 상속으로 부여받았는가(자기 부서 또는 그 상위가 부여)
    function userInherited(userId) {
        var ps = userParts[userId]; if (!ps) return false;
        for (var p of ps) if (partHasGrantedAncestor(p)) return true;
        return false;
    }
    function userEffective(userId) {
        return (userInherited(userId) || usersAllow.has(userId)) && !usersDeny.has(userId);
    }

    // ── 렌더 ──────────────────────────────────────────────────
    function renderTree() {
        // 재렌더(권한 저장 후 loadTree 등) 시 기존 펼침 상태 보존.
        // 최초 로드는 펼쳐둔 노드가 없으므로 자연히 '모두 접기'가 기본이 된다.
        var expanded = {};
        dom.tree.querySelectorAll(".tpart").forEach(function (li) {
            if (!li.classList.contains("collapsed") && li.getAttribute("data-part-id")) {
                expanded[li.getAttribute("data-part-id")] = true;
            }
        });
        var ul = document.createElement("ul");
        roots.forEach(function (pid) { ul.appendChild(renderPart(pid)); });
        dom.tree.innerHTML = "";
        dom.tree.appendChild(ul);
        // 기본은 접힘, 직전에 펼쳐져 있던 노드만 복원
        dom.tree.querySelectorAll(".tpart").forEach(function (li) {
            li.classList.toggle("collapsed", !expanded[li.getAttribute("data-part-id")]);
        });
        applySearch();
    }

    function renderPart(partId) {
        var p = partsById[partId];
        var li = document.createElement("li");
        li.className = "tpart";
        li.setAttribute("data-part-id", partId);  // 재렌더 시 펼침 상태 보존용

        var node = document.createElement("div");
        node.className = "tnode part";
        var hasChildren = (childrenOf[partId] && childrenOf[partId].length) || (usersByPart[partId] && usersByPart[partId].length);
        var directGranted = grantedParts.has(partId);
        var inheritedAnc = !directGranted && partHasGrantedAncestor(partId);
        if (directGranted || inheritedAnc) node.classList.add("granted");

        node.innerHTML =
            '<span class="tw-toggle' + (hasChildren ? "" : " leaf") + '">▾</span>' +
            '<span class="ticon">' + ICON_PART + '</span>' +
            '<input type="checkbox" class="cb-part"' + (directGranted ? " checked" : "") + '>' +
            '<span class="tlabel">' + esc(p.partName || partId) + '</span>' +
            '<span class="tsub">' + esc(partId) + '</span>' +
            (inheritedAnc ? '<span class="tbadge">상속</span>' : "");
        li.appendChild(node);

        var toggle = node.querySelector(".tw-toggle");
        if (hasChildren) toggle.addEventListener("click", function () { li.classList.toggle("collapsed"); });
        node.querySelector(".cb-part").addEventListener("change", function () {
            applyGrant("PART", partId, this.checked ? "ALLOW" : "REMOVE");
        });

        var childUl = document.createElement("ul");
        (childrenOf[partId] || []).forEach(function (cid) { childUl.appendChild(renderPart(cid)); });
        (usersByPart[partId] || []).forEach(function (u) { childUl.appendChild(renderUser(u)); });
        li.appendChild(childUl);
        return li;
    }

    function renderUser(u) {
        var li = document.createElement("li");
        var node = document.createElement("div");
        node.className = "tnode user";
        node.setAttribute("data-search", (u.userName || "") + " " + (u.userId || ""));
        var eff = userEffective(u.userId);
        var deny = usersDeny.has(u.userId);
        var inh = userInherited(u.userId);
        if (deny) node.classList.add("denied");
        else if (eff) node.classList.add("granted");
        var badge = deny ? '<span class="tbadge deny">제외</span>'
            : (inh && !usersAllow.has(u.userId) ? '<span class="tbadge">상속</span>' : "");
        node.innerHTML =
            '<span class="tw-toggle leaf"></span>' +
            '<span class="ticon">' + ICON_USER + '</span>' +
            '<input type="checkbox" class="cb-user"' + (eff ? " checked" : "") + '>' +
            '<span class="tlabel">' + esc(u.userName || u.userId) + '</span>' +
            '<span class="tsub">' + esc(u.userId) + '</span>' + badge;
        li.appendChild(node);

        node.querySelector(".cb-user").addEventListener("change", function () {
            var on = this.checked;
            var inherited = userInherited(u.userId);
            var action = on ? (inherited ? "REMOVE" : "ALLOW") : (inherited ? "DENY" : "REMOVE");
            applyGrant("USER", u.userId, action);
        });
        return li;
    }

    // ── 권한 적용 ─────────────────────────────────────────────
    // 서버 grant 액션을 로컬 상태(grantedParts/usersAllow/usersDeny)에 그대로 반영
    function mutateLocal(type, id, action) {
        if (type === "PART") {
            if (action === "ALLOW") grantedParts.add(id); else grantedParts.delete(id); // REMOVE
        } else { // USER
            if (action === "ALLOW") { usersAllow.add(id); usersDeny.delete(id); }
            else if (action === "DENY") { usersDeny.add(id); usersAllow.delete(id); }
            else { usersAllow.delete(id); usersDeny.delete(id); } // REMOVE
        }
    }

    // 낙관적 갱신: 로컬 상태 즉시 반영·재렌더(로딩/서버조회 없음), 저장은 백그라운드.
    // 저장 실패 시에만 loadTree()로 서버 상태와 재동기화.
    function applyGrant(type, id, action) {
        mutateLocal(type, id, action);
        renderTree();
        postForm("/at-i/users/grant", { adminId: adminId(), dept: currentDept, targetType: type, targetId: id, action: action })
            .then(function (r) { return r.text(); })
            .then(function (t) {
                if (String(t || "").trim() !== "ok") { notify("저장 실패 — 서버 상태로 되돌립니다.", "error"); loadTree(); }
            })
            .catch(function () { notify("저장 중 오류 — 서버 상태로 되돌립니다.", "error"); loadTree(); });
    }

    // ── 검색/펼침 ─────────────────────────────────────────────
    function applySearch() {
        var kw = (dom.search.value || "").trim().toLowerCase();
        var userNodes = dom.tree.querySelectorAll(".tnode.user");
        for (var i = 0; i < userNodes.length; i++) {
            var t = (userNodes[i].getAttribute("data-search") || "").toLowerCase();
            userNodes[i].parentElement.style.display = (!kw || t.indexOf(kw) >= 0) ? "" : "none";
        }
        if (kw) expandAll();
    }
    function expandAll() { dom.tree.querySelectorAll(".tpart").forEach(function (li) { li.classList.remove("collapsed"); }); }
    function collapseAll() { dom.tree.querySelectorAll(".tpart").forEach(function (li) { li.classList.add("collapsed"); }); }

    function logout() {
        var fd = new FormData(); fd.append("adminId", adminId());
        fetch("/at-i/logout", { method: "POST", body: fd, credentials: "same-origin" })
            .finally(function () {
                sessionStorage.removeItem("userId"); sessionStorage.removeItem("adminId");
                window.location.href = "/at-i";
            });
    }

    // ── 바인딩 ────────────────────────────────────────────────
    if (dom.search) dom.search.addEventListener("input", applySearch);
    if (dom.btnExpand) dom.btnExpand.addEventListener("click", expandAll);
    if (dom.btnCollapse) dom.btnCollapse.addEventListener("click", collapseAll);
    if (dom.btnLogout) dom.btnLogout.addEventListener("click", logout);
    if (dom.btnSaveLabel) dom.btnSaveLabel.addEventListener("click", saveLabel);
    if (dom.labelInput) dom.labelInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); saveLabel(); }
    });

    renderTabs();
    loadTree();
})();
