/**
 * 관리자 · 사용자 부서 (dept 탭 + 조직도 트리 + 접근 권한)
 * - 상단 탭: dept-a/dept-b (ultari.dept.codes)
 * - 트리: 인사DB msg_part(조직) + msg_user(사용자). 조직/사용자 체크로 해당 dept 권한 부여
 * - 조직 부여는 하위 상속, 사용자 체크 해제 시 상속분은 예외(DENY) 처리
 * API: POST /admin/users/tree, /admin/users/grant
 */
(function () {
    "use strict";

    var deptCodes = Array.isArray(window.deptCodes) ? window.deptCodes : [];
    var currentDept = deptCodes.length ? String(deptCodes[0]) : "";

    var dom = {
        tabs: document.getElementById("deptTabs"),
        tree: document.getElementById("treeRoot"),
        loading: document.getElementById("loadingOverlay"),
        search: document.getElementById("treeSearch"),
        btnExpand: document.getElementById("btnExpandAll"),
        btnCollapse: document.getElementById("btnCollapseAll"),
        btnLogout: document.getElementById("btnLogout"),
    };

    // 트리/권한 상태
    var partsById = {}, childrenOf = {}, usersByPart = {}, userParts = {}, roots = [];
    var grantedParts, usersAllow, usersDeny;

    function adminId() {
        return sessionStorage.getItem("userId") || sessionStorage.getItem("adminId") || "";
    }
    function notify(m, t) { if (typeof window.toast === "function") window.toast(m, t || "success"); }
    function showLoading(on) { if (dom.loading) dom.loading.style.display = on ? "flex" : "none"; }
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
            b.textContent = code;
            b.addEventListener("click", function () {
                currentDept = String(code);
                renderTabs();
                loadTree();
            });
            dom.tabs.appendChild(b);
        });
    }

    // ── 데이터 로드 ───────────────────────────────────────────
    function loadTree() {
        if (!currentDept) return;
        showLoading(true);
        postForm("/admin/users/tree", { adminId: adminId(), dept: currentDept })
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
            var high = p.partHigh;
            if (high && partsById[high]) (childrenOf[high] = childrenOf[high] || []).push(p.partId);
            else roots.push(p.partId);  // 부모가 없거나(루트: 예 '0') 미존재 → 루트
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
        var ul = document.createElement("ul");
        roots.forEach(function (pid) { ul.appendChild(renderPart(pid)); });
        dom.tree.innerHTML = "";
        dom.tree.appendChild(ul);
        applySearch();
    }

    function renderPart(partId) {
        var p = partsById[partId];
        var li = document.createElement("li");
        li.className = "tpart";

        var node = document.createElement("div");
        node.className = "tnode part";
        var hasChildren = (childrenOf[partId] && childrenOf[partId].length) || (usersByPart[partId] && usersByPart[partId].length);
        var directGranted = grantedParts.has(partId);
        var inheritedAnc = !directGranted && partHasGrantedAncestor(partId);

        node.innerHTML =
            '<span class="tw-toggle' + (hasChildren ? "" : " leaf") + '">▾</span>' +
            '<input type="checkbox" class="cb-part"' + (directGranted ? " checked" : "") + '>' +
            '<span class="tlabel">' + esc(p.partName || partId) + '</span>' +
            '<span class="tsub">(' + esc(partId) + ')</span>' +
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
        var badge = deny ? '<span class="tbadge deny">제외</span>'
            : (inh && !usersAllow.has(u.userId) ? '<span class="tbadge">상속</span>' : "");
        node.innerHTML =
            '<span class="tw-toggle leaf"></span>' +
            '<input type="checkbox" class="cb-user"' + (eff ? " checked" : "") + '>' +
            '<span class="tlabel">' + esc(u.userName || u.userId) + '</span>' +
            '<span class="tsub">(' + esc(u.userId) + ')</span>' + badge;
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
    function applyGrant(type, id, action) {
        showLoading(true);
        postForm("/admin/users/grant", { adminId: adminId(), dept: currentDept, targetType: type, targetId: id, action: action })
            .then(function (r) { return r.text(); })
            .then(function (t) {
                if (String(t || "").trim() === "ok") { notify("저장됨", "success"); loadTree(); }
                else { notify("저장 실패", "error"); showLoading(false); }
            })
            .catch(function () { notify("저장 중 오류", "error"); showLoading(false); });
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
        fetch("/admin/logout", { method: "POST", body: fd, credentials: "same-origin" })
            .finally(function () {
                sessionStorage.removeItem("userId"); sessionStorage.removeItem("adminId");
                window.location.href = "/admin";
            });
    }

    // ── 바인딩 ────────────────────────────────────────────────
    if (dom.search) dom.search.addEventListener("input", applySearch);
    if (dom.btnExpand) dom.btnExpand.addEventListener("click", expandAll);
    if (dom.btnCollapse) dom.btnCollapse.addEventListener("click", collapseAll);
    if (dom.btnLogout) dom.btnLogout.addEventListener("click", logout);

    renderTabs();
    loadTree();
})();
