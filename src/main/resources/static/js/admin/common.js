(function () {
    function getSessionUserId() {
        return sessionStorage.getItem("adminId") || "";
    }

    function checkSession() {
        const adminId = getSessionUserId();

        if (!adminId) {
            window.location.href = "/admin";
            return false;
        }

        const userNameEl = document.getElementById("userName");
        const userAvatarEl = document.getElementById("userAvatar");

        if (userNameEl) userNameEl.textContent = adminId;
        if (userAvatarEl) userAvatarEl.textContent = adminId.charAt(0).toUpperCase();

        return true;
    }

    window.checkSession = checkSession;
})();
