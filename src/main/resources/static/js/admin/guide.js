(function () {
    "use strict";

    function $(sel) {
        return document.querySelector(sel);
    }

    function bindLogout(adminId) {
        var btnLogout = $("#btnLogout");
        if (!btnLogout) return;
        btnLogout.addEventListener("click", function () {
            var fd = new FormData();
            fd.append("adminId", adminId || "");
            fetch("/at-i/logout", { method: "POST", body: fd })
                .finally(function () {
                    sessionStorage.removeItem("adminId");
                    window.location.href = "/at-i";
                });
        });
    }

    function bindSidebar() {
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
    }

    function bindSmoothScroll() {
        var links = document.querySelectorAll("[data-scroll]");
        links.forEach(function (link) {
            link.addEventListener("click", function (e) {
                var target = document.querySelector(link.getAttribute("href"));
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });
    }

    function init() {
        if (!window.checkSession || !checkSession()) return;

        var adminId = sessionStorage.getItem("adminId");
        if (!adminId) {
            var fromBody = document.body.getAttribute("data-admin-id") || "";
            if (fromBody) {
                adminId = fromBody;
                sessionStorage.setItem("adminId", adminId);
            }
        }

        bindLogout(adminId);
        bindSidebar();
        bindSmoothScroll();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
