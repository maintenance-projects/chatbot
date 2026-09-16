/**
 * 관리자 · AI 벡터DB 권한 (dept 탭 + 조직도 트리 + 접근 권한)
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
        btnHrRefresh: document.getElementById("btnHrRefresh"),
        btnLogout: document.getElementById("btnLogout"),
        partitionTabs: document.getElementById("partitionTabs"),
        treeHint: document.getElementById("treeHint"),
        renameModal: document.getElementById("colRenameModal"),
        renameTitle: document.getElementById("colRenameTitle"),
        renameInput: document.getElementById("colRenameInput"),
        renameError: document.getElementById("colRenameError"),
        renameClose: document.getElementById("colRenameClose"),
        renameCancel: document.getElementById("colRenameCancel"),
        renameSave: document.getElementById("colRenameSave"),
    };

    // 권한 대상: 선택된 파티션 name(AI_PARTITION_GRANT). 파티션 0개면 "".
    var currentTarget = "";
    var partitions = [];
    var renameTargetName = "";   // 이름변경 모달이 편집 중인 파티션 식별자(name). 생성 모드면 미사용
    var modalMode = "rename";    // "create" | "rename" — 생성/이름변경 모달 공용

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
        // 벡터DB(dept)는 dept-a 단일 고정 → 탭 숨김(다축 아님). currentDept는 유지되어 파티션 로드는 정상.
        if (deptCodes.length <= 1) { dom.tabs.style.display = "none"; return; }
        dom.tabs.style.display = "";
        deptCodes.forEach(function (code) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "dept-tab" + (String(code) === currentDept ? " active" : "");
            b.textContent = labelOf(code);
            b.addEventListener("click", function () {
                currentDept = String(code);
                currentTarget = "";           // loadPartitions가 그 dept의 첫 파티션으로 채움
                renderTabs();
                loadPartitions();            // 파티션 로드 → 첫 파티션 선택 → 트리 로드
            });
            dom.tabs.appendChild(b);
        });
    }

    // ── 파티션(벡터DB 하위) 관리 ──────────────────────────────
    // 게이트웨이 GET/POST/DELETE /{dept}/admin/partitions 프록시. 응답 봉투 {code,message,partitions}.
    function loadPartitions() {
        if (!currentDept) return;
        postForm("/at-i/partitions/list", { adminId: adminId(), dept: currentDept })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                partitions = (res && String(res.code) === "0000") ? (res.partitions || []) : [];
                // seq(채번 순번) 오름차순 정렬 — 탭/첫 선택 순서를 일관되게
                partitions.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
                // 현재 선택이 목록에 없으면 첫 파티션(없으면 빈값)으로.
                if (!partitions.some(function (x) { return String(x.name) === currentTarget; })) {
                    currentTarget = partitions.length ? String(partitions[0].name) : "";
                }
                renderPartitionTabs();
                updateTreeHint();
                loadTree();
            })
            .catch(function () {
                partitions = []; currentTarget = "";
                renderPartitionTabs(); updateTreeHint(); loadTree();
                notify("파티션을 불러오지 못했습니다.", "error");
            });
    }

    // 파티션 탭 렌더. 탭 본문 클릭=대상 전환(트리 스왑), 연필=이름변경, x=삭제, +=생성.
    var ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    var ICON_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    var ICON_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

    function renderPartitionTabs() {
        if (!dom.partitionTabs) return;
        dom.partitionTabs.innerHTML = "";

        partitions.forEach(function (it) {
            var value = String(it.name);
            var label = it.description || it.name;
            var tab = document.createElement("div");
            tab.className = "partition-tab" + (value === currentTarget ? " active" : "");
            tab.addEventListener("click", function () {
                if (currentTarget === value) return;
                currentTarget = value;
                renderPartitionTabs();
                updateTreeHint();
                loadTree();
            });

            var nm = document.createElement("span");
            nm.className = "pt-name";
            nm.textContent = label;
            tab.appendChild(nm);

            var edit = document.createElement("button");
            edit.type = "button";
            edit.className = "pt-act pt-edit";
            edit.title = "이름 변경";
            edit.innerHTML = ICON_EDIT;
            edit.addEventListener("click", function (e) { e.stopPropagation(); renamePartition(value, label); });
            tab.appendChild(edit);

            var del = document.createElement("button");
            del.type = "button";
            del.className = "pt-act pt-del";
            del.title = "삭제";
            del.innerHTML = ICON_DEL;
            del.addEventListener("click", function (e) { e.stopPropagation(); deletePartition(value, label); });
            tab.appendChild(del);

            dom.partitionTabs.appendChild(tab);
        });

        // + 생성 버튼(항상 노출)
        var add = document.createElement("button");
        add.type = "button";
        add.className = "pt-add";
        add.title = "파티션 추가";
        add.innerHTML = ICON_ADD + '<span>파티션 추가</span>';
        add.addEventListener("click", openCreateModal);
        dom.partitionTabs.appendChild(add);

        if (!partitions.length) {
            var e = document.createElement("span");
            e.className = "pt-empty";
            e.textContent = "‘파티션 추가’로 첫 파티션을 만드세요.";
            dom.partitionTabs.appendChild(e);
        }
    }

    // 트리 힌트 문구를 현재 권한 대상에 맞게 갱신
    function updateTreeHint() {
        if (!dom.treeHint) return;
        dom.treeHint.textContent = currentTarget
            ? "선택한 파티션에 접근할 조직·사용자에 체크하세요 · 조직 부여는 하위 상속"
            : "파티션을 먼저 생성하면 접근 권한을 부여할 수 있습니다.";
    }

    // 생성 모달 열기 — 빈 입력, 저장 시 createPartition 경로로 처리.
    function openCreateModal() {
        if (!currentDept) return;
        modalMode = "create";
        renameTargetName = "";
        if (dom.renameTitle) dom.renameTitle.textContent = "파티션 추가";
        if (dom.renameInput) dom.renameInput.value = "";
        if (dom.renameSave) dom.renameSave.textContent = "생성";
        hideRenameError();
        if (dom.renameModal) {
            dom.renameModal.classList.add("show");
            setTimeout(function () { if (dom.renameInput) dom.renameInput.focus(); }, 200);
        }
    }

    // 이름변경 모달 열기 — 대상 파티션 식별자(name)와 현재 표시명(current)을 채운다.
    function renamePartition(name, current) {
        modalMode = "rename";
        renameTargetName = name;
        if (dom.renameTitle) dom.renameTitle.textContent = "파티션 이름 변경";
        if (dom.renameSave) dom.renameSave.textContent = "변경";
        if (dom.renameInput) dom.renameInput.value = current || "";
        hideRenameError();
        if (dom.renameModal) {
            dom.renameModal.classList.add("show");
            setTimeout(function () { if (dom.renameInput) { dom.renameInput.focus(); dom.renameInput.select(); } }, 200);
        }
    }

    function closeRenameModal() {
        if (dom.renameModal) dom.renameModal.classList.remove("show");
        renameTargetName = "";
    }

    function showRenameError(msg) {
        if (!dom.renameError) return;
        dom.renameError.textContent = msg;
        dom.renameError.style.display = "";
    }
    function hideRenameError() {
        if (!dom.renameError) return;
        dom.renameError.textContent = "";
        dom.renameError.style.display = "none";
    }

    // 생성/이름변경 공용 저장 — modalMode에 따라 게이트웨이 create/rename 프록시 호출.
    function saveModal() {
        hideRenameError();
        var nv = (dom.renameInput.value || "").trim();
        var isCreate = modalMode === "create";
        if (!isCreate && !renameTargetName) { closeRenameModal(); return; }
        if (!nv) { showRenameError(isCreate ? "파티션 이름을 입력해주세요." : "새 이름을 입력해주세요."); return; }

        var url = isCreate ? "/at-i/partitions/create" : "/at-i/partitions/rename";
        var params = isCreate
            ? { adminId: adminId(), dept: currentDept, description: nv }
            : { adminId: adminId(), dept: currentDept, name: renameTargetName, description: nv };

        dom.renameSave.disabled = true;
        dom.renameSave.textContent = isCreate ? "생성 중..." : "변경 중...";
        postForm(url, params)
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res && String(res.code) === "0000") {
                    // 생성 시 새 파티션을 바로 선택하도록 currentTarget 갱신 후 재로딩
                    if (isCreate) currentTarget = "";  // loadPartitions가 첫/신규 파티션으로 채움
                    closeRenameModal();
                    notify(isCreate ? "파티션이 생성되었습니다." : "이름이 변경되었습니다.", "success");
                    loadPartitions();
                } else {
                    showRenameError((res && res.message) ? res.message
                        : (isCreate ? "생성에 실패했습니다." : "이름 변경에 실패했습니다."));
                }
            })
            .catch(function () { showRenameError(isCreate ? "생성 중 오류가 발생했습니다." : "이름 변경 중 오류가 발생했습니다."); })
            .finally(function () { dom.renameSave.disabled = false; dom.renameSave.textContent = isCreate ? "생성" : "변경"; });
    }

    function deletePartition(name, label) {
        if (!window.confirm("파티션 '" + label + "'을(를) 삭제할까요?")) return;
        showLoading(true);
        postForm("/at-i/partitions/delete", { adminId: adminId(), dept: currentDept, name: name })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res && String(res.code) === "0000") {
                    notify("파티션이 삭제되었습니다.", "success");
                    loadPartitions();
                } else {
                    notify((res && res.message) ? res.message : "삭제에 실패했습니다.", "error");
                }
            })
            .catch(function () { notify("삭제 중 오류가 발생했습니다.", "error"); })
            .finally(function () { showLoading(false); });
    }

    // ── 데이터 로드 ───────────────────────────────────────────
    function loadTree() {
        if (!currentDept) return;
        if (!currentTarget) {   // 선택된 파티션 없음(파티션 0개) → 트리 대신 안내
            dom.tree.innerHTML = '<div class="cp-empty" style="padding:16px 4px;">먼저 파티션을 생성하세요.</div>';
            return;
        }
        showLoading(true);
        postForm("/at-i/users/tree", { adminId: adminId(), dept: currentDept, partition: currentTarget })
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
            // 상속(상위 부여)된 하위 부서도 체크 표시 → '비어있어 다시 체크'하는 중복 부여 방지
            '<input type="checkbox" class="cb-part"' + ((directGranted || inheritedAnc) ? " checked" : "") + '>' +
            '<span class="tlabel">' + esc(p.partName || partId) + '</span>' +
            '<span class="tsub">' + esc(partId) + '</span>' +
            (inheritedAnc ? '<span class="tbadge">상속</span>' : "");
        li.appendChild(node);

        var toggle = node.querySelector(".tw-toggle");
        if (hasChildren) toggle.addEventListener("click", function () { li.classList.toggle("collapsed"); });
        node.querySelector(".cb-part").addEventListener("change", function () {
            var on = this.checked;
            var inherited = partHasGrantedAncestor(partId); // 상위가 부여했는가
            if (on) {
                if (inherited) return; // 이미 상속으로 부여됨 → 직접 부여 불필요(중복 방지)
                applyGrant("PART", partId, "ALLOW");
            } else {
                // 끄기: 직접 부여면 제거, 상속만이면 되돌림(상위에서 해제해야 함)
                if (grantedParts.has(partId)) {
                    applyGrant("PART", partId, "REMOVE");
                } else {
                    this.checked = true;
                    notify("상위 부서에서 상속된 권한입니다. 상위 부서에서 해제하세요.", "error");
                }
            }
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
        postForm("/at-i/users/grant", { adminId: adminId(), dept: currentDept, partition: currentTarget, targetType: type, targetId: id, action: action })
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

    // HR 사용자·부서 인메모리 스냅샷 수동 새로고침(신규자 즉시 반영) → 갱신 후 트리 재로딩
    function hrRefresh() {
        if (dom.btnHrRefresh) dom.btnHrRefresh.disabled = true;
        showLoading(true);
        postForm("/at-i/users/hr-refresh", { adminId: adminId() })
            .then(function (r) { return r.text(); })
            .then(function (t) {
                notify("사용자·부서 새로고침 완료 (" + String(t || "").trim() + "명)", "success");
                loadTree(); // 갱신된 목록 반영(loadTree가 로딩 표시/해제 담당)
            })
            .catch(function () { notify("새로고침 중 오류가 발생했습니다.", "error"); showLoading(false); })
            .finally(function () { if (dom.btnHrRefresh) dom.btnHrRefresh.disabled = false; });
    }

    // ── 바인딩 ────────────────────────────────────────────────
    if (dom.search) dom.search.addEventListener("input", applySearch);
    if (dom.btnExpand) dom.btnExpand.addEventListener("click", expandAll);
    if (dom.btnCollapse) dom.btnCollapse.addEventListener("click", collapseAll);
    if (dom.btnHrRefresh) dom.btnHrRefresh.addEventListener("click", hrRefresh);
    if (dom.btnLogout) dom.btnLogout.addEventListener("click", logout);
    // 파티션 생성/이름변경 공용 모달 ( + 버튼·연필은 renderPartitionTabs에서 바인딩)
    if (dom.renameClose) dom.renameClose.addEventListener("click", closeRenameModal);
    if (dom.renameCancel) dom.renameCancel.addEventListener("click", closeRenameModal);
    if (dom.renameSave) dom.renameSave.addEventListener("click", saveModal);
    if (dom.renameInput) dom.renameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); saveModal(); }
    });
    if (dom.renameModal) dom.renameModal.addEventListener("click", function (e) {
        if (e.target === dom.renameModal) closeRenameModal();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && dom.renameModal && dom.renameModal.classList.contains("show")) {
            closeRenameModal();
        }
    });

    renderTabs();
    loadPartitions();   // 파티션 로드 → 첫 파티션 자동 선택 → 트리 로드
})();
