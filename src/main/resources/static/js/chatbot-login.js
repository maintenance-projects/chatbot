(function () {
    "use strict";

    var form = document.getElementById("loginForm");
    var userIdInput = document.getElementById("userId");
    var passwordInput = document.getElementById("password");
    var errorBox = document.getElementById("errorMessage");
    var btnText = document.querySelector(".btn-text");
    var btnLoader = document.querySelector(".btn-loader");
    var loginBtn = document.querySelector(".login-btn");

    function showError(message) {
        if (!errorBox) return;
        var span = errorBox.querySelector("span");
        if (span) span.textContent = message;
        errorBox.style.display = "block";
    }

    function hideError() {
        if (!errorBox) return;
        errorBox.style.display = "none";
    }

    function setLoading(isLoading) {
        if (loginBtn) loginBtn.disabled = !!isLoading;
        if (btnText) btnText.style.display = isLoading ? "none" : "inline";
        if (btnLoader) btnLoader.style.display = isLoading ? "inline" : "none";
    }

    function getErrorMessage(code) {
        if (code === "NoUser") return "아이디가 존재하지 않습니다.";
        if (code === "NoPassword") return "비밀번호가 일치하지 않습니다.";
        if (code === "NoSession") return "로그인이 필요합니다.";
        return "로그인에 실패했습니다.";
    }

    function handleSubmit(e) {
        e.preventDefault();
        hideError();

        var userId = (userIdInput && userIdInput.value || "").trim();
        var password = passwordInput && passwordInput.value || "";

        if (!userId) {
            showError("아이디를 입력해 주세요.");
            if (userIdInput) userIdInput.focus();
            return;
        }
        if (!password) {
            showError("비밀번호를 입력해 주세요.");
            if (passwordInput) passwordInput.focus();
            return;
        }

        setLoading(true);

        fetch("/chatbot/login", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=UTF-8" },
            body: JSON.stringify({ userId: userId, password: password })
        })
            .then(function (res) { return res.text(); })
            .then(function (text) {
                var code = (text || "").trim();
                if (code === "ok") {
                    window.location.href = "/chatbot/" + encodeURIComponent(userId);
                    return;
                }
                showError(getErrorMessage(code));
            })
            .catch(function () {
                showError("서버 연결에 실패했습니다.");
            })
            .finally(function () {
                setLoading(false);
            });
    }

    if (form) {
        form.addEventListener("submit", handleSubmit);
    }

    if (window.loginError) {
        showError(getErrorMessage(String(window.loginError)));
    }
})();
