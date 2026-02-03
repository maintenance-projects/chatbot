(function () {
    function checkSession() {
        const adminId = sessionStorage.getItem("userId");
        console.log('adminId:', adminId);
        if (!adminId) {
            window.location.href = "/admin";
            return false;
        }

        console.log('zzzzzzzzzzzzzzzzzz');
        const userNameEl = document.getElementById("userName");
        const userAvatarEl = document.getElementById("userAvatar");

        if (userNameEl) userNameEl.textContent = adminId;
        if (userAvatarEl) userAvatarEl.textContent = adminId.charAt(0).toUpperCase();

        return true;
    }

    window.checkSession = checkSession;
})();
