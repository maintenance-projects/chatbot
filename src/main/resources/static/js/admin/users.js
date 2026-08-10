/**
 * 관리자 · 사용자 부서 관리
 * MSG_USER 목록을 불러와 사용자별 DEPT를 드롭다운으로 지정한다.
 * API: POST /admin/users/list, /admin/users/search, /admin/users/updateDept
 */
(function () {
    "use strict";

    var deptCodes = Array.isArray(window.deptCodes) ? window.deptCodes : [];

    var dom = {
        body: document.getElementById("userTableBody"),
        info: document.getElementById("tableInfo"),
        loading: document.getElementById("loadingOverlay"),
        searchField: document.getElementById("searchField"),
        searchInput: document.getElementById("searchInput"),
        btnSearch: document.getElementById("btnSearch"),
        btnRefresh: document.getElementById("btnRefresh"),
        btnLogout: document.getElementById("btnLogout"),
    };

    function adminId() {
        return sessionStorage.getItem("userId") || sessionStorage.getItem("adminId") || "";
    }
    function notify(msg, type) {
        if (typeof window.toast === "function") window.toast(msg, type || "success");
        else console.log(msg);
    }
    function showLoading(on) {
        if (dom.loading) dom.loading.style.display = on ? "flex" : "none";
    }
    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function deptSelect(userId, current) {
        var opts = '<option value="">(미지정)</option>';
        for (var i = 0; i < deptCodes.length; i++) {
            var c = String(deptCodes[i]);
            opts += '<option value="' + esc(c) + '"' + (c === current ? " selected" : "") + ">" + esc(c) + "</option>";
        }
        return '<select class="search-select dept-select" data-user="' + esc(userId) + '">' + opts + "</select>";
    }

    function render(rows) {
        dom.body.innerHTML = "";
        if (!rows.length) {
            dom.body.innerHTML = '<tr><td colspan="5" class="center" style="padding:24px;color:#6b7280;">사용자가 없습니다.</td></tr>';
            if (dom.info) dom.info.textContent = "총 0명";
            return;
        }
        var html = "";
        for (var i = 0; i < rows.length; i++) {
            var u = rows[i];
            html +=
                "<tr>" +
                '<td class="center">' + (i + 1) + "</td>" +
                "<td>" + esc(u.userId) + "</td>" +
                "<td>" + esc(u.userName) + "</td>" +
                "<td>" + esc(u.userHigh) + "</td>" +
                '<td class="center">' + deptSelect(u.userId, String(u.dept || "")) + "</td>" +
                "</tr>";
        }
        dom.body.innerHTML = html;
        if (dom.info) dom.info.textContent = "총 " + rows.length + "명";

        var selects = dom.body.querySelectorAll(".dept-select");
        for (var j = 0; j < selects.length; j++) {
            selects[j].addEventListener("change", function () {
                updateDept(this.getAttribute("data-user"), this.value, this);
            });
        }
    }

    function postForm(url, params) {
        var fd = new FormData();
        Object.keys(params).forEach(function (k) { fd.append(k, params[k]); });
        return fetch(url, { method: "POST", body: fd, credentials: "same-origin" });
    }

    function loadUsers() {
        showLoading(true);
        postForm("/admin/users/list", { adminId: adminId() })
            .then(function (r) { return r.json(); })
            .then(function (arr) { render(Array.isArray(arr) ? arr : []); })
            .catch(function () { notify("목록을 불러오지 못했습니다.", "error"); render([]); })
            .finally(function () { showLoading(false); });
    }

    function searchUsers() {
        var kw = (dom.searchInput.value || "").trim();
        if (!kw) { loadUsers(); return; }
        showLoading(true);
        postForm("/admin/users/search", { adminId: adminId(), field: dom.searchField.value, keyword: kw })
            .then(function (r) { return r.json(); })
            .then(function (arr) { render(Array.isArray(arr) ? arr : []); })
            .catch(function () { notify("검색에 실패했습니다.", "error"); })
            .finally(function () { showLoading(false); });
    }

    function updateDept(userId, dept, selectEl) {
        if (selectEl) selectEl.disabled = true;
        postForm("/admin/users/updateDept", { adminId: adminId(), userId: userId, dept: dept })
            .then(function (r) { return r.text(); })
            .then(function (t) {
                if (String(t || "").trim() === "ok") notify(userId + " → " + (dept || "(미지정)") + " 저장됨", "success");
                else notify("저장 실패: " + t, "error");
            })
            .catch(function () { notify("저장 중 오류가 발생했습니다.", "error"); })
            .finally(function () { if (selectEl) selectEl.disabled = false; });
    }

    function logout() {
        var fd = new FormData();
        fd.append("adminId", adminId());
        fetch("/admin/logout", { method: "POST", body: fd, credentials: "same-origin" })
            .finally(function () {
                sessionStorage.removeItem("userId");
                sessionStorage.removeItem("adminId");
                window.location.href = "/admin";
            });
    }

    // 바인딩
    if (dom.btnSearch) dom.btnSearch.addEventListener("click", searchUsers);
    if (dom.searchInput) dom.searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); searchUsers(); }
    });
    if (dom.btnRefresh) dom.btnRefresh.addEventListener("click", loadUsers);
    if (dom.btnLogout) dom.btnLogout.addEventListener("click", logout);

    loadUsers();
})();
