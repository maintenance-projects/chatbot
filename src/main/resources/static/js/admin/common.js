(function () {
    function checkSession() {
        const adminId = sessionStorage.getItem("userId");

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
